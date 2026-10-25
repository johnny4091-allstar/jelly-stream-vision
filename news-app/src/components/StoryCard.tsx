import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { memo, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { openStory, shareStory } from '../services/actions';
import { getSource } from '../sources';
import { useSaved } from '../state/SavedContext';
import { type, useTheme } from '../theme';
import type { Story } from '../types';
import { timeAgo } from '../utils';

export type CardVariant = 'hero' | 'standard' | 'compact';

interface Props {
  story: Story;
  variant?: CardVariant;
  /** Position in the list, used to stagger the fade-in. */
  index?: number;
}

function StoryCardImpl({ story, variant = 'standard', index = 0 }: Props) {
  const c = useTheme();
  const { isSaved, toggleSaved } = useSaved();
  const saved = isSaved(story.id);
  const scale = useRef(new Animated.Value(1)).current;
  const appear = useRef(new Animated.Value(0)).current;
  const sourceColor = getSource(story.sourceId)?.color ?? c.accent;

  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: 320,
      delay: Math.min(index, 6) * 50,
      useNativeDriver: true,
    }).start();
  }, [appear, index]);

  const pressTo = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 4 }).start();

  const onSave = () => {
    Haptics.selectionAsync().catch(() => {});
    toggleSaved(story);
  };

  const compact = variant === 'compact';
  const hero = variant === 'hero';
  const hasImage = !!story.imageUrl;

  const meta = (
    <View style={styles.metaRow}>
      <Text style={[type.meta, { color: sourceColor }]} numberOfLines={1}>
        {story.sourceName.toUpperCase()}
      </Text>
      {story.publishedAt ? (
        <Text style={[type.caption, { color: c.tertiary }]}>{`  ·  ${timeAgo(story.publishedAt)}`}</Text>
      ) : null}
    </View>
  );

  const actions = (
    <View style={styles.actions}>
      <Pressable
        onPress={() => shareStory(story)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Share story"
        style={styles.iconBtn}
      >
        <Ionicons name="share-outline" size={20} color={c.secondary} />
      </Pressable>
      <Pressable
        onPress={onSave}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Remove from saved' : 'Save for later'}
        style={styles.iconBtn}
      >
        <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? c.accent : c.secondary} />
      </Pressable>
    </View>
  );

  return (
    <Animated.View
      style={{
        opacity: appear,
        transform: [
          { scale },
          { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
        ],
      }}
    >
      <Pressable
        onPress={() => openStory(story, { toolbar: c.card, controls: c.accent })}
        onPressIn={() => pressTo(0.97)}
        onPressOut={() => pressTo(1)}
        accessibilityRole="link"
        accessibilityLabel={`${story.title}, ${story.sourceName}`}
        style={[styles.card, { backgroundColor: c.card }, c.dark ? null : styles.shadow]}
      >
        {compact ? (
          <View style={styles.compactRow}>
            <View style={styles.compactText}>
              {meta}
              <Text style={[type.title, styles.compactTitle, { color: c.text }]} numberOfLines={3}>
                {story.title}
              </Text>
              {story.summary ? (
                <Text style={[type.caption, { color: c.secondary }]} numberOfLines={2}>
                  {story.summary}
                </Text>
              ) : null}
            </View>
            {hasImage ? (
              <Image
                source={{ uri: story.imageUrl }}
                style={[styles.thumb, { backgroundColor: c.skeleton }]}
                contentFit="cover"
                transition={250}
                recyclingKey={story.id}
              />
            ) : null}
          </View>
        ) : (
          <>
            {hasImage ? (
              <Image
                source={{ uri: story.imageUrl }}
                style={[hero ? styles.heroImage : styles.image, { backgroundColor: c.skeleton }]}
                contentFit="cover"
                transition={300}
                recyclingKey={story.id}
              />
            ) : null}
            <View style={styles.body}>
              {meta}
              <Text
                style={[hero ? type.heroTitle : type.title, styles.title, { color: c.text }]}
                numberOfLines={hero ? 4 : 3}
              >
                {story.title}
              </Text>
              {story.summary ? (
                <Text style={[type.body, { color: c.secondary }]} numberOfLines={hero ? 4 : 3}>
                  {story.summary}
                </Text>
              ) : null}
            </View>
          </>
        )}
        <View style={[styles.footer, { borderTopColor: c.separator }]}>{actions}</View>
      </Pressable>
    </Animated.View>
  );
}

export const StoryCard = memo(StoryCardImpl);

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  heroImage: { width: '100%', aspectRatio: 4 / 3 },
  image: { width: '100%', aspectRatio: 16 / 9 },
  body: { paddingHorizontal: 16, paddingTop: 14, gap: 6 },
  title: { marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  compactRow: { flexDirection: 'row', padding: 14, gap: 14 },
  compactText: { flex: 1, gap: 6 },
  compactTitle: { fontSize: 17, lineHeight: 22 },
  thumb: { width: 92, height: 92, borderRadius: 12 },
  footer: {
    marginTop: 10,
    marginHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 18 },
  iconBtn: { padding: 4 },
});
