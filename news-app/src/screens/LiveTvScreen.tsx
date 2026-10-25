import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useScrollToTop } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { AppHeader, SectionHeader, useTabBarSpace } from '../components/common';
import { LIVE_CHANNELS, LIVE_PLAYER_ORIGIN, livePlayerHtml, liveWatchUrl, type LiveChannel } from '../live';
import { type, useTheme } from '../theme';

const YOUTUBE_HOSTS = /^https:\/\/([a-z0-9-]+\.)*(youtube\.com|youtube-nocookie\.com|googlevideo\.com|ytimg\.com|google\.com|gstatic\.com|doubleclick\.net)\//i;

function LiveBadge() {
  return (
    <View style={styles.live}>
      <Ionicons name="play" size={10} color="#fff" />
      <Text style={styles.liveText}>LIVE</Text>
    </View>
  );
}

/** Pinned player for the selected channel. Only mounted while the tab is on screen, so audio stops when you leave. */
function Player({ channel, playing }: { channel: LiveChannel; playing: boolean }) {
  const c = useTheme();
  return (
    <View style={{ backgroundColor: c.background, paddingBottom: 6 }}>
      <View style={styles.player}>
        {playing ? (
          <WebView<object>
            key={channel.id}
            source={{ html: livePlayerHtml(channel), baseUrl: LIVE_PLAYER_ORIGIN }}
            style={styles.web}
            allowsInlineMediaPlayback
            allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={false}
            setSupportMultipleWindows={false}
            // The player stays in the frame; tapping through to YouTube opens the YouTube app.
            onShouldStartLoadWithRequest={(req) => {
              if (req.url === 'about:blank' || req.url.startsWith(LIVE_PLAYER_ORIGIN) || YOUTUBE_HOSTS.test(req.url)) {
                if (/youtube\.com\/(watch|channel|@)/.test(req.url) && !req.url.includes('/embed/')) {
                  Linking.openURL(req.url).catch(() => {});
                  return false;
                }
                return true;
              }
              Linking.openURL(req.url).catch(() => {});
              return false;
            }}
          />
        ) : (
          <View style={[styles.web, styles.paused]}>
            <Ionicons name="tv-outline" size={40} color="rgba(255,255,255,0.6)" />
          </View>
        )}
      </View>
      <View style={styles.nowRow}>
        <LiveBadge />
        <Text style={[styles.nowName, { color: c.text }]} numberOfLines={1}>
          {channel.name}
        </Text>
        <Pressable
          onPress={() => Linking.openURL(liveWatchUrl(channel)).catch(() => {})}
          hitSlop={8}
          accessibilityRole="link"
          style={[styles.openYt, { borderColor: c.separator }]}
        >
          <Ionicons name="logo-youtube" size={16} color="#FF0000" />
          <Text style={[styles.openYtText, { color: c.text }]}>YouTube</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ChannelTile({ channel, active, onPress }: { channel: LiveChannel; active: boolean; onPress: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Watch ${channel.name}`}
      style={[styles.tile, { backgroundColor: c.card, borderColor: active ? c.text : 'transparent' }]}
    >
      <View style={[styles.tileArt, { backgroundColor: channel.color }]}>
        <Text style={styles.tileWordmark} numberOfLines={2}>
          {channel.short}
        </Text>
        <View style={styles.tileBadge}>
          {active ? (
            <View style={styles.live}>
              <Ionicons name="volume-high" size={10} color="#fff" />
              <Text style={styles.liveText}>WATCHING</Text>
            </View>
          ) : (
            <LiveBadge />
          )}
        </View>
      </View>
      <View style={styles.tileBody}>
        <Text style={[type.rowTitle, { color: c.text }]} numberOfLines={1}>
          {channel.name}
        </Text>
        <Text style={[type.caption, { color: c.tertiary }]} numberOfLines={2}>
          {channel.description}
        </Text>
      </View>
    </Pressable>
  );
}

/** Free live news channels, Samsung TV Plus style: player on top, channel tiles below. */
export function LiveTvScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarSpace();
  const focused = useIsFocused();
  const [channel, setChannel] = useState<LiveChannel>(LIVE_CHANNELS[0]!);
  const scrollRef = useRef<ScrollViewInstance>(null);
  useScrollToTop(scrollRef);

  return (
    <ScrollView
      ref={scrollRef}
      style={{ backgroundColor: c.background }}
      stickyHeaderIndices={[1]}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: bottom }}
    >
      <AppHeader />
      <Player channel={channel} playing={focused} />
      <SectionHeader title="Live TV" subtitle="Free 24/7 news channels" />
      <View style={styles.grid}>
        {LIVE_CHANNELS.map((ch) => (
          <ChannelTile
            key={ch.id}
            channel={ch}
            active={ch.id === channel.id}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setChannel(ch);
              scrollRef.current?.scrollTo({ y: 0, animated: true });
            }}
          />
        ))}
      </View>
      <Text style={[type.caption, styles.note, { color: c.tertiary }]}>
        These are the channels' own free live streams on YouTube. If a channel is off air or won't play here, tap
        YouTube to watch it there.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  player: { marginHorizontal: 12, borderRadius: 18, overflow: 'hidden', aspectRatio: 16 / 9, backgroundColor: '#000' },
  web: { flex: 1, backgroundColor: '#000' },
  paused: { alignItems: 'center', justifyContent: 'center' },
  nowRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  nowName: { flex: 1, fontSize: 17, fontWeight: '800' },
  openYt: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  openYtText: { fontSize: 14, fontWeight: '600' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E8352E', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  liveText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  tile: { width: '46%', marginHorizontal: '2%', marginBottom: 12, borderRadius: 20, overflow: 'hidden', borderWidth: 2 },
  tileArt: { aspectRatio: 16 / 10, alignItems: 'center', justifyContent: 'center', padding: 10 },
  tileWordmark: { color: '#fff', fontSize: 21, fontWeight: '900', textAlign: 'center', letterSpacing: -0.3 },
  tileBadge: { position: 'absolute', left: 10, bottom: 10 },
  tileBody: { padding: 12, gap: 4 },
  note: { paddingHorizontal: 20, paddingTop: 8, lineHeight: 18 },
});
