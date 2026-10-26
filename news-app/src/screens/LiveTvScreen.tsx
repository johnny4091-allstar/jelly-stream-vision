import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useScrollToTop } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { AppHeader, SectionHeader, useTabBarSpace } from '../components/common';
import {
  LIVE_CHANNELS,
  LIVE_PLAYER_ORIGIN,
  liveChannelUrl,
  livePlayerHtml,
  liveWatchUrl,
  resolveLive,
  type LiveChannel,
  type LiveResult,
} from '../live';
import { openWatch } from '../navigation';
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

/** Plain message inside the player box (loading, off air, couldn't connect). */
function PlayerMessage({ icon, title, action }: { icon?: keyof typeof Ionicons.glyphMap; title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={[styles.web, styles.paused]}>
      {icon ? <Ionicons name={icon} size={34} color="rgba(255,255,255,0.7)" /> : <ActivityIndicator color="#fff" />}
      <Text style={styles.playerMsg}>{title}</Text>
      {action ? (
        <Pressable onPress={action.onPress} style={styles.playerBtn} accessibilityRole="button">
          <Text style={styles.playerBtnText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Pinned player for the selected channel. Looks up the stream that's live now and plays it with
 * YouTube's player; if the broadcaster blocks playback in other apps, offers YouTube's own watch
 * page in the app instead. Only plays while the tab is on screen, so audio stops when you leave.
 */
function Player({ channel, playing }: { channel: LiveChannel; playing: boolean }) {
  const c = useTheme();
  const [result, setResult] = useState<LiveResult | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setBlocked(false);
    resolveLive(channel, attempt > 0).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [channel, attempt]);

  const live = result?.status === 'live' ? result : null;
  const watchInApp = () => live && openWatch(liveWatchUrl(live.videoId), channel.name);
  const retry = () => setAttempt((n) => n + 1);

  let body;
  if (!result) {
    body = <PlayerMessage title={`Finding ${channel.name}…`} />;
  } else if (result.status === 'offline') {
    body = <PlayerMessage icon="moon-outline" title={`${channel.name} isn't live right now`} action={{ label: 'Try again', onPress: retry }} />;
  } else if (result.status === 'error') {
    body = <PlayerMessage icon="cloud-offline-outline" title="Couldn't reach YouTube" action={{ label: 'Try again', onPress: retry }} />;
  } else if (!result.embeddable || blocked) {
    body = (
      <Pressable onPress={watchInApp} style={styles.web} accessibilityRole="button" accessibilityLabel={`Watch ${channel.name}`}>
        <Image source={{ uri: `https://i.ytimg.com/vi/${result.videoId}/hqdefault_live.jpg` }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={[StyleSheet.absoluteFill, styles.dim]} />
        <View style={[styles.web, styles.paused, { backgroundColor: 'transparent' }]}>
          <Ionicons name="play-circle" size={64} color="#fff" />
          <Text style={styles.playerMsg}>Tap to watch</Text>
        </View>
      </Pressable>
    );
  } else if (!playing) {
    body = <PlayerMessage icon="tv-outline" title={channel.name} />;
  } else {
    body = (
      <WebView<object>
        key={result.videoId}
        source={{ html: livePlayerHtml(result.videoId), baseUrl: LIVE_PLAYER_ORIGIN }}
        style={styles.web}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        onMessage={(e) => {
          if (e.nativeEvent.data.startsWith('error:')) setBlocked(true);
        }}
        // The player stays in the frame; links out of it open in the app's reader.
        onShouldStartLoadWithRequest={(req) => {
          if (req.url === 'about:blank' || req.url.startsWith(LIVE_PLAYER_ORIGIN) || /\/embed\//.test(req.url)) return true;
          if (YOUTUBE_HOSTS.test(req.url) && !/youtube\.com\/(watch|channel|@|shorts)/.test(req.url)) return true;
          openWatch(req.url, channel.name);
          return false;
        }}
      />
    );
  }

  return (
    <View style={{ backgroundColor: c.background, paddingBottom: 6 }}>
      <View style={styles.player}>{body}</View>
      <View style={styles.nowRow}>
        {live ? <LiveBadge /> : null}
        <Text style={[styles.nowName, { color: c.text }]} numberOfLines={1}>
          {channel.name}
        </Text>
        <Pressable
          onPress={() => (live ? watchInApp() : Linking.openURL(liveChannelUrl(channel)).catch(() => {}))}
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
        These are the channels' own free live streams on YouTube. A few broadcasters don't allow their stream inside
        other apps; for those, tap the picture to watch on YouTube's site without leaving News Hammer.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  player: { marginHorizontal: 12, borderRadius: 18, overflow: 'hidden', aspectRatio: 16 / 9, backgroundColor: '#000' },
  web: { flex: 1, backgroundColor: '#000' },
  paused: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  dim: { backgroundColor: 'rgba(0,0,0,0.35)' },
  playerMsg: { color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  playerBtn: { borderRadius: 999, borderWidth: 1.5, borderColor: '#fff', paddingHorizontal: 16, paddingVertical: 6 },
  playerBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
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
