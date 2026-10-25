import { useNavigation, useScrollToTop } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { RefreshControl, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppHeader,
  EmptyState,
  MoreLink,
  ScrollTopButton,
  SectionHeader,
  useScrollTopVisibility,
  useTabBarSpace,
} from '../components/common';
import { StoryCard } from '../components/StoryCard';
import { TopicSection } from '../components/TopicSection';
import { useSaved } from '../state/SavedContext';
import { useSettings } from '../state/SettingsContext';
import { TOPICS } from '../sources';
import { useTheme } from '../theme';

const SAVED_PREVIEW = 5;

/** Saved stories, then a section for each followed topic. */
export function FollowingScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarSpace();
  const navigation = useNavigation();
  const { saved } = useSaved();
  const { followed } = useSettings();
  const [showAllSaved, setShowAllSaved] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  useScrollToTop(scrollRef);
  const scrollTop = useScrollTopVisibility();

  const savedShown = showAllSaved ? saved : saved.slice(0, SAVED_PREVIEW);
  // Keep the News tab's order for followed topics.
  const topics = TOPICS.filter((t) => followed.includes(t.id));

  const refresh = () => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 1200);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: bottom }}
        onScroll={scrollTop.onScroll}
        scrollEventThrottle={scrollTop.scrollEventThrottle}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.tertiary} progressViewOffset={insets.top} />
        }
      >
        <AppHeader />

        <SectionHeader title="Saved" subtitle={saved.length ? `${saved.length} saved on this phone` : undefined} />
        {saved.length === 0 ? (
          <EmptyState
            icon="bookmark-outline"
            title="Nothing saved yet"
            message="Tap the bookmark on any story to keep it here for later."
          />
        ) : (
          savedShown.map((s, i) => <StoryCard key={s.id} story={s} index={i} />)
        )}
        {saved.length > SAVED_PREVIEW ? (
          <MoreLink
            label={showAllSaved ? 'Show fewer' : `All ${saved.length} saved stories`}
            onPress={() => setShowAllSaved((v) => !v)}
          />
        ) : null}

        {topics.length === 0 ? (
          <>
            <SectionHeader title="Topics" />
            <EmptyState
              icon="notifications-outline"
              title="Follow topics you care about"
              message="Tap Follow on any section in News and it shows up here."
              action={{ label: 'Go to News', onPress: () => navigation.navigate('News' as never) }}
            />
          </>
        ) : (
          topics.map((t) => <TopicSection key={t.id} topic={t.id} refreshToken={refreshKey} />)
        )}
      </ScrollView>
      <ScrollTopButton visible={scrollTop.visible} onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} />
    </View>
  );
}
