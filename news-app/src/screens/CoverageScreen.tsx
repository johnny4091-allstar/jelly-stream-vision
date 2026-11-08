import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StackHeader } from '../components/common';
import { openArticle, type CoverageScreenProps } from '../navigation';
import { findCoverage } from '../services/coverage';
import { cachedStories } from '../services/news';
import { getSource } from '../sources';
import { useSettings } from '../state/SettingsContext';
import { fonts, type, useTheme } from '../theme';
import type { Story } from '../types';
import { timeAgo } from '../utils';

/** How many other outlets have the same story, from everything loaded so far. */
export function useCoverage(story: Story | undefined) {
  return useMemo(() => (story ? findCoverage(story, cachedStories()) : { stories: [], outlets: 0 }), [story]);
}

/** One story across outlets: who's covering it, how each one headlined it, newest first. */
export function CoverageScreen({ route }: CoverageScreenProps) {
  const { story } = route.params;
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const coverage = useCoverage(story);
  const { recordActivity } = useSettings();
  useEffect(() => recordActivity('coverage'), []); // eslint-disable-line react-hooks/exhaustive-deps
  const newest = coverage.stories[0];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StackHeader title="Full coverage" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 32, gap: 18 }}>
        <Text style={[styles.headline, { color: c.text }]}>{story.title}</Text>

        <View style={{ gap: 8 }}>
          <View style={styles.between}>
            <Text style={[styles.count, { color: c.text }]}>
              {coverage.outlets} {coverage.outlets === 1 ? 'outlet' : 'outlets'} covering
            </Text>
            {newest?.publishedAt ? <Text style={[type.caption, { color: c.tertiary }]}>Updated {timeAgo(newest.publishedAt).toLowerCase()}</Text> : null}
          </View>
          <View style={styles.bar}>
            {coverage.stories.map((s) => (
              <View key={s.sourceId} style={[styles.segment, { backgroundColor: getSource(s.sourceId)?.color ?? c.tertiary }]} />
            ))}
          </View>
          <View style={styles.names}>
            {coverage.stories.map((s) => (
              <View key={s.sourceId} style={[styles.pill, { backgroundColor: c.card, borderColor: c.border }]}>
                <View style={[styles.dot, { backgroundColor: getSource(s.sourceId)?.color ?? c.tertiary }]} />
                <Text style={[styles.pillText, { color: c.text }]}>{s.sourceName}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={[type.eyebrow, { color: c.tertiary }]}>How each outlet put it</Text>
        <View>
          {coverage.stories.map((s, i) => {
            const last = i === coverage.stories.length - 1;
            return (
              <Pressable
                key={s.id}
                onPress={() => openArticle(s)}
                accessibilityRole="link"
                accessibilityLabel={`${s.sourceName}: ${s.title}`}
                style={styles.item}
              >
                <View style={styles.rail}>
                  <View style={[styles.node, { backgroundColor: i === 0 ? c.accent : c.separator }]} />
                  {last ? null : <View style={[styles.line, { backgroundColor: c.separator }]} />}
                </View>
                <View style={[styles.itemBody, { paddingBottom: last ? 0 : 18 }]}>
                  <Text style={[type.eyebrow, { color: i === 0 ? c.accentText : c.tertiary }]}>
                    {s.sourceName}
                    {s.publishedAt ? ` · ${timeAgo(s.publishedAt)}` : ''}
                  </Text>
                  <Text style={[type.rowTitle, { color: c.text }]}>{s.title}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {coverage.outlets <= 1 ? (
          <Text style={[type.body, { color: c.secondary }]}>
            No other outlets have this story yet. Check back soon, or open more topics so News Hammer can compare them.
          </Text>
        ) : (
          <Text style={[type.caption, { color: c.tertiary }]}>Matched by headline across your sources. Tap any one to read it.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headline: { fontFamily: fonts.heading, fontSize: 32, lineHeight: 34, marginTop: 4 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  count: { fontSize: 15, fontWeight: '800' },
  bar: { flexDirection: 'row', gap: 2, height: 10, borderRadius: 5, overflow: 'hidden' },
  segment: { flex: 1 },
  names: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { fontSize: 13, fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  item: { flexDirection: 'row', gap: 12 },
  rail: { width: 14, alignItems: 'center' },
  node: { width: 12, height: 12, borderRadius: 6, marginTop: 2 },
  line: { width: 2, flex: 1, marginTop: 2 },
  itemBody: { flex: 1, gap: 4 },
});
