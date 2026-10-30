import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDuration, latestEpisodes, latestVideos, type Episode, type Video } from '../media';
import { openMedia, openVideo } from '../navigation';
import { useAudio } from '../state/AudioContext';
import { type, useTheme } from '../theme';
import { timeAgo } from '../utils';
import { SectionHeader } from './common';

/** Loads a list once and on demand; `items` is null until the first load finishes. */
function useLoader<T>(load: (force: boolean) => Promise<T[]>) {
  const [items, setItems] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = useCallback(
    async (force = true) => {
      setLoading(true);
      try {
        setItems(await load(force));
      } catch {
        setItems((prev) => prev ?? []);
      } finally {
        setLoading(false);
      }
    },
    [load],
  );
  useEffect(() => {
    refresh(false);
  }, [refresh]);
  return { items, loading, refresh };
}

export const useLatestVideos = () => useLoader<Video>(latestVideos);
export const useLatestEpisodes = () => useLoader<Episode>(latestEpisodes);

export function VideoCard({ video, wide }: { video: Video; wide?: boolean }) {
  const c = useTheme();
  return (
    <Pressable
      onPress={() => openVideo(video)}
      style={[wide ? styles.videoWide : styles.video, { backgroundColor: c.card }]}
      accessibilityRole="button"
      accessibilityLabel={`Play video: ${video.title}, ${video.channel}`}
    >
      <View>
        <Image source={{ uri: video.thumbnail }} style={styles.thumb} contentFit="cover" transition={200} recyclingKey={video.id} />
        <View style={styles.playBadge}>
          <Ionicons name="play" size={14} color="#fff" />
        </View>
      </View>
      <View style={styles.videoText}>
        <Text style={[type.rowTitle, { color: c.text, fontSize: wide ? 17 : 15, lineHeight: wide ? 22 : 19 }]} numberOfLines={wide ? 3 : 2}>
          {video.title}
        </Text>
        <Text style={[type.caption, { color: c.tertiary }]} numberOfLines={1}>
          {video.channel} · {timeAgo(video.publishedAt)}
        </Text>
      </View>
    </Pressable>
  );
}

export function EpisodeCard({ episode, row }: { episode: Episode; row?: boolean }) {
  const c = useTheme();
  const { episode: current, status, play, toggle } = useAudio();
  const isCurrent = current?.id === episode.id;
  const playing = isCurrent && status.playing;
  const onPress = () => (isCurrent ? toggle() : play(episode));
  const meta = [timeAgo(episode.publishedAt), formatDuration(episode.duration)].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      style={[row ? styles.episodeRow : styles.episode, { backgroundColor: c.card }]}
      accessibilityRole="button"
      accessibilityLabel={`${playing ? 'Pause' : 'Play'} ${episode.show}: ${episode.title}`}
    >
      <Image source={{ uri: episode.imageUrl }} style={row ? styles.artSmall : styles.art} contentFit="cover" transition={200} />
      <View style={{ flex: row ? 1 : undefined, gap: 3 }}>
        <Text style={[styles.show, { color: c.secondary }]} numberOfLines={1}>
          {episode.show}
        </Text>
        <Text style={[type.rowTitle, { color: c.text, fontSize: 15, lineHeight: 19 }]} numberOfLines={2}>
          {episode.title}
        </Text>
        <View style={styles.epMeta}>
          <Ionicons name={playing ? 'pause-circle' : 'play-circle'} size={22} color={c.accent} />
          <Text style={[type.caption, { color: c.tertiary }]} numberOfLines={1}>
            {meta}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/** "Watch" and "Listen" shelves for For you. */
export function MediaShelves() {
  const c = useTheme();
  const videos = useLatestVideos();
  const episodes = useLatestEpisodes();
  const loading = <ActivityIndicator style={{ marginVertical: 24 }} color={c.tertiary} />;
  return (
    <>
      <SectionHeader title="Watch" subtitle="Latest videos from news channels" onPress={() => openMedia('videos')} />
      {videos.items === null ? (
        loading
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
          {videos.items.slice(0, 10).map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </ScrollView>
      )}
      <SectionHeader title="Listen" subtitle="Today's news podcasts" onPress={() => openMedia('podcasts')} />
      {episodes.items === null ? (
        loading
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
          {episodes.items.map((e) => (
            <EpisodeCard key={e.id} episode={e} />
          ))}
        </ScrollView>
      )}
    </>
  );
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** The podcast that's playing, floating above the tab bar (or the bottom edge on other screens). */
export function MiniPlayer({ aboveTabs }: { aboveTabs: boolean }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { episode, status, toggle, skip, stop } = useAudio();
  if (!episode) return null;
  const progress = status.duration ? status.currentTime / status.duration : 0;
  return (
    <View
      pointerEvents="box-none"
      style={[styles.miniWrap, { bottom: insets.bottom + (aboveTabs ? 92 : 12) }]}
    >
      <View style={[styles.mini, { backgroundColor: c.card }]}>
        <Image source={{ uri: episode.imageUrl }} style={styles.miniArt} contentFit="cover" />
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={[styles.miniTitle, { color: c.text }]} numberOfLines={1}>
            {episode.title}
          </Text>
          <Text style={[type.caption, { color: c.tertiary }]} numberOfLines={1}>
            {status.isBuffering && !status.playing ? 'Loading…' : `${episode.show} · ${clock(status.currentTime)}${status.duration ? ` / ${clock(status.duration)}` : ''}`}
          </Text>
        </View>
        <Pressable onPress={() => skip(-15)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Back 15 seconds">
          <Ionicons name="play-back" size={20} color={c.text} />
        </Pressable>
        <Pressable onPress={toggle} hitSlop={6} accessibilityRole="button" accessibilityLabel={status.playing ? 'Pause' : 'Play'}>
          <Ionicons name={status.playing ? 'pause-circle' : 'play-circle'} size={40} color={c.accent} />
        </Pressable>
        <Pressable onPress={() => skip(30)} hitSlop={6} accessibilityRole="button" accessibilityLabel="Forward 30 seconds">
          <Ionicons name="play-forward" size={20} color={c.text} />
        </Pressable>
        <Pressable onPress={stop} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close player">
          <Ionicons name="close" size={20} color={c.tertiary} />
        </Pressable>
        <View style={[styles.miniTrack, { backgroundColor: c.separator }]}>
          <View style={[styles.miniFill, { width: `${Math.min(100, progress * 100)}%`, backgroundColor: c.accent }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shelf: { paddingHorizontal: 12, gap: 10, paddingBottom: 6 },
  video: { width: 250, borderRadius: 18, overflow: 'hidden' },
  videoWide: { marginHorizontal: 12, marginBottom: 12, borderRadius: 20, overflow: 'hidden' },
  thumb: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  playBadge: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoText: { padding: 12, gap: 4 },
  episode: { width: 170, borderRadius: 18, padding: 10, gap: 8 },
  episodeRow: { flexDirection: 'row', gap: 12, marginHorizontal: 12, marginBottom: 8, borderRadius: 18, padding: 10, alignItems: 'center' },
  art: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#333' },
  artSmall: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#333' },
  show: { fontSize: 12, fontWeight: '800' },
  epMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  miniWrap: { position: 'absolute', left: 10, right: 10 },
  mini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 12,
  },
  miniArt: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#333' },
  miniTitle: { fontSize: 14, fontWeight: '700' },
  miniTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3 },
  miniFill: { height: 3 },
});
