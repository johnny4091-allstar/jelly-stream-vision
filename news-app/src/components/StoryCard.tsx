import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useRef } from 'react';
import { Alert, Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { openArticle } from '../navigation';
import { shareStory } from '../services/actions';
import { getSource } from '../sources';
import { useSaved } from '../state/SavedContext';
import { type, useTheme } from '../theme';
import type { Story } from '../types';
import { timeAgo } from '../utils';

/**
 * - `row`: Samsung News list card. Source, headline and summary on the left, thumbnail on the
 *   right, time and actions underneath.
 * - `lead`: a row with a bigger headline and thumbnail, used first in a section.
 * - `overlay`: full-bleed image with the headline over a dark gradient.
 */
export type CardVariant = 'row' | 'lead' | 'overlay';

interface Props {
  story: Story;
  variant?: CardVariant;
  /** Position in the list, used to stagger the fade-in. */
  index?: number;
}

/** Brand colours like Fox News navy vanish on a dark card; mix them toward white there. */
function readable(hex: string, dark: boolean): string {
  if (!dark || !/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const mix = (i: number) => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.55 + 255 * 0.45);
  return `rgb(${mix(1)},${mix(3)},${mix(5)})`;
}

function useAppear(index: number) {
  const appear = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: 280,
      delay: Math.min(index, 6) * 40,
      useNativeDriver: true,
    }).start();
  }, [appear, index]);
  return appear;
}

/** Long-press / ⋮ menu: share or save. */
export function showStoryMenu(story: Story, saved: boolean, toggleSaved: (s: Story) => void) {
  Haptics.selectionAsync().catch(() => {});
  Alert.alert(story.sourceName, story.title, [
    { text: 'Cancel', style: 'cancel' },
    { text: saved ? 'Remove from saved' : 'Save for later', onPress: () => toggleSaved(story) },
    { text: 'Share', onPress: () => shareStory(story) },
  ]);
}

function StoryCardImpl({ story, variant = 'row', index = 0 }: Props) {
  const c = useTheme();
  const { isSaved, toggleSaved } = useSaved();
  const saved = isSaved(story.id);
  const scale = useRef(new Animated.Value(1)).current;
  const appear = useAppear(index);
  const sourceColor = readable(getSource(story.sourceId)?.color ?? c.accent, c.dark);
  const time = timeAgo(story.publishedAt);

  const pressTo = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 3 }).start();
  const onSave = () => {
    Haptics.selectionAsync().catch(() => {});
    toggleSaved(story);
  };
  const menu = () => showStoryMenu(story, saved, toggleSaved);

  const animated = {
    opacity: appear,
    transform: [{ scale }, { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  };
  const pressable = {
    onPress: () => openArticle(story),
    onLongPress: menu,
    onPressIn: () => pressTo(0.98),
    onPressOut: () => pressTo(1),
    accessibilityRole: 'link' as const,
    accessibilityLabel: `${story.title}, ${story.sourceName}, ${time}`,
  };

  if (variant === 'overlay') {
    return (
      <Animated.View style={[styles.overlayWrap, animated]}>
        <Pressable {...pressable} style={[styles.overlay, { backgroundColor: c.skeleton }]}>
          {story.imageUrl ? (
            <Image
              source={{ uri: story.imageUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={300}
              recyclingKey={story.id}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: sourceColor }]} />
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.85)']}
            locations={[0.25, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.overlayText}>
            <Text style={[type.heroTitle, styles.white]} numberOfLines={4}>
              {story.title}
            </Text>
            <View style={styles.overlayMeta}>
              <Text style={[type.meta, styles.white]} numberOfLines={1}>
                {story.sourceName.toUpperCase()}
              </Text>
              {time ? <Text style={[type.caption, styles.whiteDim]}>{`  ·  ${time}`}</Text> : null}
              <View style={{ flex: 1 }} />
              <Pressable onPress={onSave} hitSlop={10} accessibilityRole="button" accessibilityLabel={saved ? 'Remove from saved' : 'Save for later'}>
                <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color="#fff" />
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  const lead = variant === 'lead';
  return (
    <Animated.View style={animated}>
      <Pressable {...pressable} style={[styles.row, { backgroundColor: c.card }]}>
        <View style={styles.rowTop}>
          <View style={styles.rowText}>
            <Text style={[styles.source, { color: sourceColor }]} numberOfLines={1}>
              {story.sourceName}
            </Text>
            <Text style={[lead ? type.title : type.rowTitle, { color: c.text }]} numberOfLines={lead ? 4 : 3}>
              {story.title}
            </Text>
            {story.summary ? (
              <Text style={[type.caption, { color: c.secondary, lineHeight: 18 }]} numberOfLines={2}>
                {story.summary}
              </Text>
            ) : null}
          </View>
          {story.imageUrl ? (
            <Image
              source={{ uri: story.imageUrl }}
              style={[lead ? styles.leadThumb : styles.thumb, { backgroundColor: c.skeleton }]}
              contentFit="cover"
              transition={250}
              recyclingKey={story.id}
            />
          ) : null}
        </View>
        <View style={styles.rowBottom}>
          <Text style={[type.caption, { color: c.tertiary, flex: 1 }]}>{time}</Text>
          <Pressable onPress={onSave} hitSlop={10} accessibilityRole="button" accessibilityLabel={saved ? 'Remove from saved' : 'Save for later'} style={styles.icon}>
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={19} color={saved ? c.accent : c.tertiary} />
          </Pressable>
          <Pressable onPress={menu} hitSlop={10} accessibilityRole="button" accessibilityLabel="More options" style={styles.icon}>
            <Ionicons name="ellipsis-vertical" size={17} color={c.tertiary} />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export const StoryCard = memo(StoryCardImpl);

const styles = StyleSheet.create({
  row: { borderRadius: 20, marginHorizontal: 12, marginBottom: 10, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 },
  rowTop: { flexDirection: 'row', gap: 14 },
  rowText: { flex: 1, gap: 5 },
  source: { fontSize: 14, fontWeight: '800', letterSpacing: -0.1 },
  thumb: { width: 96, height: 96, borderRadius: 14 },
  leadThumb: { width: 128, height: 128, borderRadius: 16 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
  icon: { padding: 4 },
  overlayWrap: { marginHorizontal: 12, marginBottom: 10 },
  overlay: { borderRadius: 22, overflow: 'hidden', aspectRatio: 1.15, justifyContent: 'flex-end' },
  overlayText: { padding: 18, gap: 10 },
  overlayMeta: { flexDirection: 'row', alignItems: 'center' },
  white: { color: '#fff' },
  whiteDim: { color: 'rgba(255,255,255,0.8)' },
});
