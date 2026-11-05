import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { openShareSheet } from '../components/ShareSheet';
import { goBack, openArticle } from '../navigation';
import { pickTopStories } from '../services/news';
import { useStoryImage } from '../services/previewImage';
import { getSource } from '../sources';
import { useSaved } from '../state/SavedContext';
import { useStories } from '../state/useStories';
import type { Story } from '../types';
import { timeAgo } from '../utils';

const COUNT = 8;

function RailButton({ icon, label, onPress, active }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.railItem} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.railCircle, active && { backgroundColor: 'rgba(255,255,255,0.32)' }]}>
        <Ionicons name={icon} size={22} color="#fff" />
      </View>
      <Text style={styles.railText}>{label}</Text>
    </Pressable>
  );
}

function Page({
  story,
  height,
  first,
  speaking,
  onListen,
}: {
  story: Story;
  height: number;
  first: boolean;
  speaking: boolean;
  onListen: () => void;
}) {
  const insets = useSafeAreaInsets();
  const image = useStoryImage(story);
  const { isSaved, toggleSaved } = useSaved();
  const saved = isSaved(story.id);
  return (
    <View style={{ height, backgroundColor: '#000' }}>
      {image ? (
        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: getSource(story.sourceId)?.color ?? '#222' }]} />
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.93)']}
        locations={[0, 0.22, 0.42, 0.8]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.content, { bottom: insets.bottom + 96 }]}>
        <Text style={styles.source}>{story.sourceName.toUpperCase()}</Text>
        <Text style={styles.title} numberOfLines={5}>
          {story.title}
        </Text>
        {story.summary ? (
          <Text style={styles.summary} numberOfLines={5}>
            {story.summary}
          </Text>
        ) : null}
        <Text style={styles.time}>{timeAgo(story.publishedAt)}</Text>
        <Pressable onPress={() => openArticle(story)} style={styles.readBtn} accessibilityRole="button">
          <Text style={styles.readText}>Read full story</Text>
          <Ionicons name="arrow-forward" size={16} color="#000" />
        </Pressable>
      </View>
      <View style={[styles.rail, { bottom: insets.bottom + 110 }]}>
        <RailButton
          icon={saved ? 'heart' : 'heart-outline'}
          label={saved ? 'Saved' : 'Save'}
          active={saved}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            toggleSaved(story);
          }}
        />
        <RailButton icon="arrow-redo-outline" label="Share" onPress={() => openShareSheet({ title: story.title, link: story.link })} />
        <RailButton icon={speaking ? 'stop' : 'volume-high-outline'} label={speaking ? 'Stop' : 'Listen'} active={speaking} onPress={onListen} />
      </View>
      {first ? (
        <View style={[styles.hint, { bottom: insets.bottom + 28 }]} pointerEvents="none">
          <Ionicons name="chevron-up" size={22} color="rgba(255,255,255,0.8)" />
          <Text style={styles.hintText}>Swipe up for the next story</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Today's top stories, one per screen: swipe up for the next, tap through to read in full. */
export function QuickReadScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { stories, loading } = useStories('top');
  const [index, setIndex] = useState(0);
  const [speaking, setSpeaking] = useState<string | null>(null);

  const picks = useMemo(() => {
    const withImages = stories.filter((s) => s.imageUrl);
    return pickTopStories(withImages.length >= COUNT ? withImages : stories, COUNT);
  }, [stories]);

  // Stop reading aloud when the story changes or the screen closes.
  useEffect(() => {
    Speech.stop().catch(() => {});
    setSpeaking(null);
  }, [index]);
  useEffect(() => () => void Speech.stop().catch(() => {}), []);

  const listen = (story: Story) => {
    if (speaking === story.id) {
      Speech.stop().catch(() => {});
      setSpeaking(null);
      return;
    }
    Speech.stop().catch(() => {});
    setSpeaking(story.id);
    Speech.speak(`${story.title}. ${story.summary}`, {
      onDone: () => setSpeaking(null),
      onStopped: () => setSpeaking((s) => (s === story.id ? null : s)),
      onError: () => setSpeaking(null),
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" />
      {picks.length === 0 ? (
        <View style={styles.center}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.summary}>No stories to show right now.</Text>}
        </View>
      ) : (
        <FlatList
          data={picks}
          keyExtractor={(s) => s.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.y / height))}
          renderItem={({ item, index: i }) => (
            <Page story={item} height={height} first={i === 0} speaking={speaking === item.id} onListen={() => listen(item)} />
          )}
        />
      )}
      <View style={[styles.top, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <View style={styles.bars}>
          {picks.map((s, i) => (
            <View key={s.id} style={[styles.bar, i <= index && styles.barOn]} />
          ))}
        </View>
        <View style={styles.topRow}>
          <View style={styles.pill}>
            <Ionicons name="flash" size={14} color="#fff" />
            <Text style={styles.pillText}>
              Quick read{picks.length ? ` · ${Math.min(index + 1, picks.length)} of ${picks.length}` : ''}
            </Text>
          </View>
          <Pressable onPress={goBack} hitSlop={10} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 14, gap: 10 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  barOn: { backgroundColor: '#fff' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  content: { position: 'absolute', left: 20, right: 84, gap: 10 },
  source: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  title: { color: '#fff', fontSize: 30, lineHeight: 35, fontWeight: '800', letterSpacing: -0.4 },
  summary: { color: 'rgba(255,255,255,0.88)', fontSize: 16, lineHeight: 23 },
  time: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  readBtn: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, marginTop: 6 },
  readText: { color: '#000', fontWeight: '800', fontSize: 15 },
  rail: { position: 'absolute', right: 12, gap: 18, alignItems: 'center' },
  railItem: { alignItems: 'center', gap: 4 },
  railCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  railText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  hint: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  hintText: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
});
