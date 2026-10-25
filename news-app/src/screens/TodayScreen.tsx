import { useScrollToTop } from '@react-navigation/native';
import { useMemo, useRef } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, FailedNotice, ScreenHeader, SkeletonCard } from '../components/common';
import { StoryCard } from '../components/StoryCard';
import { pickTopStories } from '../services/news';
import { useSettings } from '../state/SettingsContext';
import { useStories } from '../state/useStories';
import { type, useTheme } from '../theme';
import { todayLabel } from '../utils';

export function TodayScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { stories, failed, loading, refreshing, refresh } = useStories('top');
  const { enabledSources } = useSettings();
  const top = useMemo(() => pickTopStories(stories, 5), [stories]);
  const scrollRef = useRef<ScrollViewInstance>(null);
  useScrollToTop(scrollRef);

  return (
    <ScrollView
      ref={scrollRef}
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 24 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.tertiary} progressViewOffset={insets.top} />
      }
    >
      <ScreenHeader title="Today" subtitle={todayLabel()} />
      <FailedNotice failed={failed} />
      {loading && top.length === 0 ? (
        <>
          <SkeletonCard />
          <SkeletonCard />
        </>
      ) : top.length === 0 ? (
        <EmptyState
          icon="newspaper-outline"
          title="No stories yet"
          message={enabledSources.length === 0 ? 'Turn on a few outlets in Settings.' : 'Pull down to try again.'}
        />
      ) : (
        <>
          <Text style={[styles.section, { color: c.accent }]}>Top Stories</Text>
          {top.map((s, i) => (
            <StoryCard key={s.id} story={s} variant={i === 0 ? 'hero' : 'compact'} index={i} />
          ))}
          <View style={styles.footer}>
            <Text style={[type.caption, { color: c.tertiary, textAlign: 'center' }]}>
              The five newest headlines across your sources. See everything in Feed.
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 22, fontWeight: '800', paddingHorizontal: 20, marginBottom: 12, letterSpacing: -0.3 },
  footer: { paddingHorizontal: 32, paddingTop: 4 },
});
