import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StackHeader } from '../components/common';
import { Globe } from '../components/Globe';
import { StoryCard } from '../components/StoryCard';
import { cachedStories } from '../services/news';
import { hotspots, type Hotspot } from '../services/pulse';
import { useStories } from '../state/useStories';
import { HAMMER, fonts, type, useTheme } from '../theme';

const PIN_COLORS = [HAMMER, '#5CC8FF', '#FFC53D', '#A78BFA', '#3FD07A', '#F472B6'];

/** Places in today's news, from every story loaded; refreshes as more stories arrive. */
export function usePulse(): { spots: Hotspot[]; total: number } {
  // Make sure the top and world feeds are loaded even if the user hasn't opened them.
  const top = useStories('top');
  const world = useStories('world');
  const [minute, setMinute] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setMinute((m) => m + 1), 60_000);
    return () => clearInterval(timer);
  }, []);
  return useMemo(() => {
    const spots = hotspots(cachedStories());
    return { spots, total: new Set(spots.flatMap((s) => s.stories.map((x) => x.link))).size };
  }, [top.stories, world.stories, minute]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** The world right now: a turning globe with a pin per place in the news, then the places. */
export function PulseScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { spots, total } = usePulse();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: '#07090F' }}>
      <StackHeader title="Pulse" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={styles.hero}>
          <View style={styles.liveRow}>
            <View style={[styles.liveDot, { backgroundColor: c.accent }]} />
            <Text style={[type.eyebrow, { color: '#9AA3B5' }]}>
              {total} stories · {spots.length} places · last 24 hours
            </Text>
          </View>
          <Globe size={Math.min(width - 28, 420)} spots={spots} labels={4} />
        </View>
        <View style={{ backgroundColor: c.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 20, minHeight: 400 }}>
          <Text style={[type.sectionTitle, { color: c.text, paddingHorizontal: 18, marginBottom: 10 }]}>Where the news is</Text>
          {spots.length === 0 ? (
            <Text style={[type.body, { color: c.secondary, paddingHorizontal: 18 }]}>Loading the latest stories… pull Explore down to refresh.</Text>
          ) : null}
          {spots.map((s, i) => {
            const expanded = open === s.place.id;
            return (
              <View key={s.place.id}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setOpen(expanded ? null : s.place.id);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={`${s.place.name}, ${s.stories.length} stories`}
                  style={[styles.place, { backgroundColor: c.card, borderColor: expanded ? PIN_COLORS[i % PIN_COLORS.length] : c.border }]}
                >
                  <View style={[styles.pin, { backgroundColor: PIN_COLORS[i % PIN_COLORS.length] }]} />
                  <Text style={[styles.placeName, { color: c.text }]}>{s.place.name}</Text>
                  <Text style={[styles.count, { color: c.secondary }]}>{s.stories.length}</Text>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={c.tertiary} />
                </Pressable>
                {expanded ? s.stories.slice(0, 8).map((story, j) => <StoryCard key={story.id} story={story} index={j} />) : null}
              </View>
            );
          })}
          <Text style={[type.caption, { color: c.tertiary, paddingHorizontal: 18, marginTop: 8 }]}>
            Places are found from the names in headlines across your sources.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingBottom: 18, gap: 10 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 14, marginBottom: 8, borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 13 },
  pin: { width: 12, height: 12, borderRadius: 6 },
  placeName: { flex: 1, fontFamily: fonts.heading, fontSize: 21, lineHeight: 23, textTransform: 'uppercase' },
  count: { fontSize: 15, fontWeight: '800' },
});
