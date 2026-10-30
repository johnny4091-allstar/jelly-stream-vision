import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { StackHeader } from '../components/common';
import { VideoCard } from '../components/Media';
import { openShareSheet } from '../components/ShareSheet';
import { LIVE_PLAYER_ORIGIN, livePlayerHtml, liveWatchUrl } from '../live';
import { VIDEO_CHANNELS, fetchChannelVideos, type Video } from '../media';
import { openWatch, type VideoScreenProps } from '../navigation';
import { useAudio } from '../state/AudioContext';
import { type, useTheme } from '../theme';
import { timeAgo } from '../utils';

/** A news video in YouTube's player, with more from the same channel underneath. */
export function VideoScreen({ route }: VideoScreenProps) {
  const { video } = route.params;
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const audio = useAudio();
  const [blocked, setBlocked] = useState(false);
  const [more, setMore] = useState<Video[]>([]);
  const youtubeLink = `https://youtu.be/${video.videoId}`;

  // A podcast and a video at once is noise: pause the podcast.
  useEffect(() => {
    if (audio.status.playing) audio.toggle();
    // Only when the video opens.
  }, [video.videoId]);

  useEffect(() => {
    setBlocked(false);
    const channel = VIDEO_CHANNELS.find((ch) => ch.id === video.channelId);
    if (!channel) return;
    let cancelled = false;
    fetchChannelVideos(channel)
      .then((v) => !cancelled && setMore(v.filter((x) => x.videoId !== video.videoId).slice(0, 8)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [video.videoId, video.channelId]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StackHeader
        title={video.channel}
        right={
          <Pressable
            onPress={() => openShareSheet({ title: video.title, link: youtubeLink })}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Share video"
            style={{ padding: 4 }}
          >
            <Ionicons name="share-outline" size={22} color={c.text} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View style={styles.player}>
          {blocked ? (
            <Pressable onPress={() => openWatch(liveWatchUrl(video.videoId), video.channel)} style={styles.blocked} accessibilityRole="button">
              <Ionicons name="play-circle" size={56} color="#fff" />
              <Text style={styles.blockedText}>This video only plays on YouTube. Tap to watch.</Text>
            </Pressable>
          ) : (
            <WebView<object>
              key={video.videoId}
              source={{ html: livePlayerHtml(video.videoId), baseUrl: LIVE_PLAYER_ORIGIN }}
              style={{ flex: 1, backgroundColor: '#000' }}
              allowsInlineMediaPlayback
              allowsFullscreenVideo
              mediaPlaybackRequiresUserAction={false}
              setSupportMultipleWindows={false}
              onMessage={(e) => {
                if (e.nativeEvent.data.startsWith('error:')) setBlocked(true);
              }}
              onShouldStartLoadWithRequest={(req) => {
                if (req.url === 'about:blank' || req.url.startsWith(LIVE_PLAYER_ORIGIN) || /\/embed\//.test(req.url)) return true;
                if (/^https:\/\/([a-z0-9-]+\.)*(youtube\.com|youtube-nocookie\.com|googlevideo\.com|ytimg\.com|google\.com|gstatic\.com|doubleclick\.net)\//i.test(req.url) && !/youtube\.com\/(watch|channel|@|shorts)/.test(req.url)) return true;
                openWatch(req.url, video.channel);
                return false;
              }}
            />
          )}
        </View>
        <View style={styles.info}>
          <Text style={[type.title, { color: c.text }]}>{video.title}</Text>
          <Text style={[type.caption, { color: c.tertiary }]}>
            {video.channel} · {timeAgo(video.publishedAt)}
          </Text>
        </View>
        {more.length > 0 ? (
          <>
            <Text style={[styles.heading, { color: c.text }]}>More from {video.channel}</Text>
            {more.map((v) => (
              <VideoCard key={v.id} video={v} wide />
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  player: { aspectRatio: 16 / 9, backgroundColor: '#000' },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  blockedText: { color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  info: { padding: 16, gap: 6 },
  heading: { fontSize: 20, fontWeight: '800', marginHorizontal: 18, marginTop: 8, marginBottom: 10 },
});
