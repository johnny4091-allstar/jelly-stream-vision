import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StackHeader } from '../components/common';
import { EpisodeCard, VideoCard, useLatestVideos } from '../components/Media';
import { PODCASTS, VIDEO_CHANNELS, fetchPodcastEpisodes, type Episode, type Podcast } from '../media';
import type { MediaScreenProps, MediaTab } from '../navigation';
import { MINI_PLAYER_SPACE, useAudio } from '../state/AudioContext';
import { useTheme } from '../theme';

const TABS: { id: MediaTab; label: string }[] = [
  { id: 'videos', label: 'Videos' },
  { id: 'podcasts', label: 'Podcasts' },
];

function Videos({ bottom }: { bottom: number }) {
  const c = useTheme();
  const { items, loading, refresh } = useLatestVideos();
  const [channel, setChannel] = useState<string | null>(null);
  const shown = (items ?? []).filter((v) => !channel || v.channelId === channel);
  const channels = VIDEO_CHANNELS.filter((ch) => items?.some((v) => v.channelId === ch.id));
  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: bottom }}
      refreshControl={<RefreshControl refreshing={loading && items !== null} onRefresh={() => refresh()} tintColor={c.tertiary} />}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {[{ id: null, name: 'All' }, ...channels].map((ch) => {
          const active = channel === ch.id;
          return (
            <Pressable
              key={ch.id ?? 'all'}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setChannel(ch.id);
              }}
              style={[styles.chip, { backgroundColor: active ? c.chipActive : c.chip }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={{ color: active ? c.chipActiveText : c.chipText, fontWeight: '700' }}>{ch.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {items === null ? <ActivityIndicator style={{ marginTop: 40 }} color={c.tertiary} /> : null}
      {shown.map((v) => (
        <VideoCard key={v.id} video={v} wide />
      ))}
    </ScrollView>
  );
}

function Show({ podcast }: { podcast: Podcast }) {
  const c = useTheme();
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchPodcastEpisodes(podcast)
      .then((e) => !cancelled && setEpisodes(e.slice(0, 3)))
      .catch(() => !cancelled && setEpisodes([]));
    return () => {
      cancelled = true;
    };
  }, [podcast]);
  if (episodes !== null && episodes.length === 0) return null;
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={styles.showHeader}>
        {episodes?.[0]?.imageUrl ? <Image source={{ uri: episodes[0].imageUrl }} style={styles.showArt} /> : <View style={[styles.showArt, { backgroundColor: podcast.color }]} />}
        <View style={{ flex: 1 }}>
          <Text style={[styles.showName, { color: c.text }]}>{podcast.name}</Text>
          <Text style={{ color: c.tertiary, fontSize: 13 }}>{podcast.publisher}</Text>
        </View>
      </View>
      {episodes === null ? <ActivityIndicator style={{ marginVertical: 12 }} color={c.tertiary} /> : null}
      {episodes?.map((e) => <EpisodeCard key={e.id} episode={e} row />)}
    </View>
  );
}

/** All videos (filter by channel) or all podcast shows with their latest episodes. */
export function MediaScreen({ route }: MediaScreenProps) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { episode } = useAudio();
  const [tab, setTab] = useState<MediaTab>(route.params.tab);
  const bottom = insets.bottom + 24 + (episode ? MINI_PLAYER_SPACE : 0);
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StackHeader title="Videos & podcasts" />
      <View style={[styles.segment, { backgroundColor: c.chip }]}>
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.segmentItem, active && { backgroundColor: c.chipActive }]}
            >
              <Text style={{ color: active ? c.chipActiveText : c.chipText, fontWeight: '700', fontSize: 15 }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {tab === 'videos' ? (
        <Videos bottom={bottom} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: bottom, paddingTop: 6 }}>
          {PODCASTS.map((p) => (
            <Show key={p.id} podcast={p} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', marginHorizontal: 12, marginBottom: 8, padding: 4, borderRadius: 999 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999 },
  chips: { paddingHorizontal: 12, gap: 8, paddingVertical: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  showHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 18, marginTop: 12, marginBottom: 8 },
  showArt: { width: 44, height: 44, borderRadius: 10 },
  showName: { fontSize: 18, fontWeight: '800' },
});
