import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

// The library's default generic (`P = undefined`) collapses its props to `never` under current
// TypeScript; `object` restores them.
type ReaderWebView = WebView<object>;

import { openCoverage, type ArticleScreenProps } from '../navigation';
import { openShareSheet } from '../components/ShareSheet';
import { useSaved } from '../state/SavedContext';
import { useSettings } from '../state/SettingsContext';
import { getSource } from '../sources';
import { type, useTheme } from '../theme';
import { useCoverage } from './CoverageScreen';

function hostOf(url: string): string {
  return /^https?:\/\/(?:www\.)?([^/]+)/.exec(url)?.[1] ?? url;
}

/** The publisher's page, shown inside the app. The app itself never copies article text. */
export function ArticleScreen({ route, navigation }: ArticleScreenProps) {
  const { story } = route.params;
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { isSaved, toggleSaved } = useSaved();
  const web = useRef<ReaderWebView>(null);
  const [progress, setProgress] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [url, setUrl] = useState(story.link);
  const [failed, setFailed] = useState(false);
  const saved = isSaved(story.id);
  const coverage = useCoverage(story);
  const [speaking, setSpeaking] = useState(false);

  const { recordActivity } = useSettings();
  // Counts toward the reading streak and badges.
  useEffect(() => recordActivity('read'), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop reading aloud when the story closes.
  useEffect(() => () => void Speech.stop().catch(() => {}), []);

  const listen = () => {
    Speech.stop().catch(() => {});
    if (speaking) return setSpeaking(false);
    setSpeaking(true);
    Speech.speak(`${story.title}. ${story.summary}`, {
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  // Android back button steps back through the page's own links before leaving the reader.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (canGoBack) {
          web.current?.goBack();
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [canGoBack]),
  );

  const iconButton = (name: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, color = c.text) => (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={label} style={styles.icon}>
      <Ionicons name={name} size={22} color={color} />
    </Pressable>
  );

  return (
    <View style={[styles.flex, { backgroundColor: c.card }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6, borderBottomColor: c.separator, backgroundColor: c.card }]}>
        {iconButton('chevron-down', 'Close', () => navigation.goBack())}
        <View style={styles.titleWrap}>
          <Text style={[type.meta, { color: c.text }]} numberOfLines={1}>
            {story.sourceName}
          </Text>
          <Text style={[type.caption, { color: c.tertiary }]} numberOfLines={1}>
            {hostOf(url)}
          </Text>
        </View>
        {iconButton('open-outline', 'Open in browser', () => Linking.openURL(url).catch(() => {}))}
      </View>
      {coverage.outlets > 1 ? (
        <Pressable
          onPress={() => openCoverage(story)}
          accessibilityRole="button"
          accessibilityLabel={`Full coverage: ${coverage.outlets} outlets`}
          style={[styles.coverage, { backgroundColor: c.background, borderBottomColor: c.border }]}
        >
          <View style={styles.coverageBar}>
            {coverage.stories.slice(0, 8).map((s) => (
              <View key={s.sourceId} style={[styles.coverageSeg, { backgroundColor: getSource(s.sourceId)?.color ?? c.tertiary }]} />
            ))}
          </View>
          <Text style={[styles.coverageText, { color: c.text }]}>
            Full coverage · <Text style={{ color: c.accentText }}>{coverage.outlets} outlets</Text>
          </Text>
          <Ionicons name="chevron-forward" size={16} color={c.accentText} />
        </Pressable>
      ) : null}
      {progress < 1 && !failed ? (
        <View style={[styles.progressTrack, { backgroundColor: c.border }]}>
          <View style={[styles.progressBar, { backgroundColor: c.accent, width: `${Math.max(5, progress * 100)}%` }]} />
        </View>
      ) : null}

      {failed ? (
        <View style={styles.error}>
          <Ionicons name="cloud-offline-outline" size={44} color={c.tertiary} />
          <Text style={[type.title, { color: c.text, textAlign: 'center' }]}>Couldn't load this story</Text>
          <Text style={[type.body, { color: c.secondary, textAlign: 'center' }]}>
            Check your connection and try again.
          </Text>
          <View style={styles.errorButtons}>
            <Pressable
              onPress={() => {
                setFailed(false);
                web.current?.reload();
              }}
              style={[styles.button, { backgroundColor: c.accent }]}
            >
              <Text style={[styles.buttonText, { color: c.onAccent }]}>Try again</Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL(url).catch(() => {})} style={[styles.button, { backgroundColor: c.chip }]}>
              <Text style={[styles.buttonText, { color: c.text }]}>Open in browser</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <WebView<object>
        ref={web}
        source={{ uri: story.link }}
        style={[styles.flex, failed && styles.hidden, { backgroundColor: c.card }]}
        onLoadProgress={(e) => setProgress(e.nativeEvent.progress)}
        onNavigationStateChange={(nav) => {
          setCanGoBack(nav.canGoBack);
          if (nav.url) setUrl(nav.url);
        }}
        onError={() => setFailed(true)}
        // Keep links that try to open a new window in this reader.
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures
        allowsInlineMediaPlayback
        pullToRefreshEnabled
        // Only web pages load here; app links (mailto:, intent:, market:) are handed to the phone.
        onShouldStartLoadWithRequest={(req) => {
          if (/^https?:/i.test(req.url) || req.url === 'about:blank') return true;
          Linking.openURL(req.url).catch(() => {});
          return false;
        }}
      />

      <View style={[styles.actions, { paddingBottom: insets.bottom + 10, backgroundColor: c.card, borderTopColor: c.border }]}>
        <Pressable onPress={listen} style={[styles.listen, { backgroundColor: c.accent }]} accessibilityRole="button" accessibilityLabel={speaking ? 'Stop reading' : 'Listen'}>
          <Ionicons name={speaking ? 'stop' : 'play'} size={18} color={c.onAccent} />
          <Text style={[styles.listenText, { color: c.onAccent }]}>{speaking ? 'Stop' : 'Listen'}</Text>
        </Pressable>
        <Pressable
          onPress={() => toggleSaved(story)}
          style={[styles.square, { backgroundColor: c.elevated, borderColor: c.border }]}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove from saved' : 'Save for later'}
        >
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={21} color={saved ? c.accentText : c.text} />
        </Pressable>
        <Pressable
          onPress={() => openShareSheet({ title: story.title, link: story.link })}
          style={[styles.square, { backgroundColor: c.elevated, borderColor: c.border }]}
          accessibilityRole="button"
          accessibilityLabel="Share story"
        >
          <Ionicons name="share-outline" size={21} color={c.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hidden: { display: 'none' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 8,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: { padding: 6 },
  titleWrap: { flex: 1, alignItems: 'center' },
  progressTrack: { height: 2 },
  progressBar: { height: 2 },
  error: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  errorButtons: { flexDirection: 'row', gap: 10, marginTop: 8 },
  button: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  coverage: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  coverageBar: { flexDirection: 'row', gap: 2, width: 56, height: 8, borderRadius: 4, overflow: 'hidden' },
  coverageSeg: { flex: 1 },
  coverageText: { flex: 1, fontSize: 14, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  listen: { flex: 1, height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  listenText: { fontSize: 16, fontWeight: '800' },
  square: { width: 52, height: 48, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});
