import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import type { WatchScreenProps } from '../navigation';
import { type, useTheme } from '../theme';

/** YouTube's own watch page inside the app, for live streams that can't be embedded. */
export function WatchScreen({ route, navigation }: WatchScreenProps) {
  const { url, title } = route.params;
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [progress, setProgress] = useState(0);
  return (
    <View style={[styles.flex, { backgroundColor: '#000' }]}>
      <View style={[styles.bar, { paddingTop: insets.top + 6, backgroundColor: c.card, borderBottomColor: c.separator }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" style={styles.icon}>
          <Ionicons name="chevron-down" size={24} color={c.text} />
        </Pressable>
        <Text style={[type.meta, { color: c.text, flex: 1, textAlign: 'center' }]} numberOfLines={1}>
          {title}
        </Text>
        <Pressable onPress={() => Linking.openURL(url).catch(() => {})} hitSlop={10} accessibilityRole="button" accessibilityLabel="Open in YouTube" style={styles.icon}>
          <Ionicons name="logo-youtube" size={22} color="#FF0000" />
        </Pressable>
      </View>
      {progress < 1 ? <View style={[styles.progress, { width: `${Math.max(5, progress * 100)}%`, backgroundColor: c.accent }]} /> : null}
      <WebView<object>
        source={{ uri: url }}
        style={styles.flex}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        onLoadProgress={(e) => setProgress(e.nativeEvent.progress)}
        onShouldStartLoadWithRequest={(req) => {
          if (/^https?:/i.test(req.url)) return true;
          // intent:// and vnd.youtube: links hand off to the YouTube app.
          Linking.openURL(req.url).catch(() => {});
          return false;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingBottom: 8, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { padding: 6 },
  progress: { height: 2 },
});
