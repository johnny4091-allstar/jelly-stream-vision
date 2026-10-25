import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { BackHandler, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

// The library's default generic (`P = undefined`) collapses its props to `never` under current
// TypeScript; `object` restores them.
type ReaderWebView = WebView<object>;

import type { ArticleScreenProps } from '../navigation';
import { shareStory } from '../services/actions';
import { useSaved } from '../state/SavedContext';
import { type, useTheme } from '../theme';

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
        {iconButton(saved ? 'bookmark' : 'bookmark-outline', saved ? 'Remove from saved' : 'Save for later', () => toggleSaved(story), saved ? c.accent : c.text)}
        {iconButton('share-outline', 'Share story', () => shareStory(story))}
      </View>
      {progress < 1 && !failed ? (
        <View style={[styles.progressTrack, { backgroundColor: c.separator }]}>
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
              <Text style={styles.buttonText}>Try again</Text>
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
});
