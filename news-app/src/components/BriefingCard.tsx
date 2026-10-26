import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { openArticle } from '../navigation';
import { useStoryImage } from '../services/previewImage';
import { getSource } from '../sources';
import { headlineFont } from '../theme';
import type { Story } from '../types';
import { partOfDay, todayLabel } from '../utils';

const TINTS = { Morning: '#46698F', Afternoon: '#5C7A5E', Evening: '#8A6C55' } as const;
const SLIDE_MS = 6000;

/** One carousel slide. Uses the article's share image when the feed has no picture. */
function Slide({ story, width }: { story: Story; width: number }) {
  const image = useStoryImage(story);
  return (
    <Pressable
      onPress={() => openArticle(story)}
      style={[styles.slide, { width }]}
      accessibilityRole="link"
      accessibilityLabel={story.title}
    >
      {image ? (
        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: getSource(story.sourceId)?.color ?? '#333' }]} />
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.88)']}
        locations={[0.2, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.slideText}>
        <Text style={styles.slideSource}>{story.sourceName.toUpperCase()}</Text>
        <Text style={styles.slideTitle} numberOfLines={4}>
          {story.title}
        </Text>
        {story.summary ? (
          <Text style={styles.slideSummary} numberOfLines={2}>
            {story.summary}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * "Evening briefing": three headlines as bullets, then a swipeable carousel of the top stories
 * that advances on its own.
 */
export function BriefingCard({ bullets, slides }: { bullets: Story[]; slides: Story[] }) {
  const { width } = useWindowDimensions();
  const part = partOfDay();
  const slideWidth = width - 16;
  const list = useRef<FlatList<Story>>(null);
  const [index, setIndex] = useState(0);
  const touching = useRef(false);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => {
      if (touching.current) return;
      setIndex((i) => {
        const next = (i + 1) % slides.length;
        list.current?.scrollToOffset({ offset: next * slideWidth, animated: true });
        return next;
      });
    }, SLIDE_MS);
    return () => clearInterval(timer);
  }, [slides.length, slideWidth]);

  return (
    <View style={[styles.card, { backgroundColor: TINTS[part] }]}>
      <View style={styles.head}>
        <Text style={styles.title}>{part} briefing</Text>
        <Text style={styles.date}>{todayLabel()}</Text>
      </View>
      <View style={styles.bullets}>
        {bullets.map((s) => (
          <Pressable key={s.id} onPress={() => openArticle(s)} style={styles.bulletRow} accessibilityRole="link">
            <Text style={styles.bulletDot}>{'•'}</Text>
            <Text style={styles.bulletText} numberOfLines={1}>
              {s.title}
            </Text>
          </Pressable>
        ))}
      </View>

      {slides.length > 0 ? (
        <View style={styles.carousel}>
          <FlatList
            ref={list}
            data={slides}
            keyExtractor={(s) => s.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_, i) => ({ length: slideWidth, offset: slideWidth * i, index: i })}
            onTouchStart={() => (touching.current = true)}
            onTouchEnd={() => (touching.current = false)}
            onMomentumScrollEnd={(e) => {
              touching.current = false;
              setIndex(Math.round(e.nativeEvent.contentOffset.x / slideWidth));
            }}
            renderItem={({ item }) => <Slide story={item} width={slideWidth} />}
          />
          <View style={styles.dots} pointerEvents="none">
            {slides.map((s, i) => (
              <View key={s.id} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingTop: 20, paddingBottom: 8, marginBottom: 8 },
  head: { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: 18, gap: 10 },
  title: { flex: 1, color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.3 },
  date: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  bullets: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14, gap: 6 },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bulletDot: { color: '#fff', fontSize: 16, lineHeight: 21 },
  bulletText: { flex: 1, color: '#fff', fontSize: 16, lineHeight: 21 },
  carousel: { marginHorizontal: 8, borderRadius: 22, overflow: 'hidden' },
  slide: { aspectRatio: 0.86, justifyContent: 'flex-end' },
  slideText: { padding: 18, paddingBottom: 30, gap: 8, alignItems: 'center' },
  slideSource: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  slideTitle: { color: '#fff', fontSize: 24, lineHeight: 29, fontWeight: '700', textAlign: 'center', fontFamily: headlineFont },
  slideSummary: { color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 19, textAlign: 'center' },
  dots: { position: 'absolute', left: 18, right: 18, bottom: 12, flexDirection: 'row', gap: 6 },
  dot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { backgroundColor: '#fff' },
});
