import { useScrollToTop } from '@react-navigation/native';
import { useMemo, useRef } from 'react';
import { RefreshControl, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BriefingCard } from '../components/BriefingCard';
import {
  AppHeader,
  EmptyState,
  FailedNotice,
  MoreLink,
  ScrollTopButton,
  SectionHeader,
  SkeletonCard,
  useScrollTopVisibility,
  useTabBarSpace,
} from '../components/common';
import { StoryCard } from '../components/StoryCard';
import { WeatherBoundary } from '../components/WeatherBoundary';
import { WeatherCard } from '../components/WeatherCard';
import { openSettings, openTopic } from '../navigation';
import { pickTopStories } from '../services/news';
import { useSettings } from '../state/SettingsContext';
import { useStories } from '../state/useStories';
import { useTheme } from '../theme';
import type { Story } from '../types';

const FOR_YOU_COUNT = 15;

/** Home tab: briefing with a carousel, Top stories, then a longer For you list. */
export function ForYouScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarSpace();
  const { stories, failed, loading, refreshing, refresh } = useStories('top');
  const { enabledSources } = useSettings();
  const scrollRef = useRef<ScrollViewInstance>(null);
  useScrollToTop(scrollRef);
  const scrollTop = useScrollTopVisibility();

  const layout = useMemo(() => {
    // The carousel is all pictures, so it draws from stories that come with one.
    const withImages = stories.filter((st) => st.imageUrl);
    const slides = pickTopStories(withImages.length >= 3 ? withImages : stories, 5);
    const used = new Set(slides.map((s) => s.id));
    const rest = stories.filter((s) => !used.has(s.id));
    const bullets = rest.slice(0, 3);
    const hero = rest.find((s) => s.imageUrl);
    const afterHero = rest.filter((s) => s !== hero);
    return {
      slides,
      bullets,
      hero,
      topRows: afterHero.slice(0, 2),
      forYou: afterHero.slice(2, 2 + FOR_YOU_COUNT),
    };
  }, [stories]);

  const empty = !loading && stories.length === 0;

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
        <WeatherBoundary>
          <WeatherCard />
        </WeatherBoundary>
        <FailedNotice failed={failed} />

        {loading && stories.length === 0 ? (
          <>
            <SkeletonCard hero />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : empty ? (
          enabledSources.length === 0 ? (
            <EmptyState
              icon="newspaper-outline"
              title="No sources on"
              message="Turn on a few outlets in Settings."
              action={{ label: 'Open Settings', onPress: openSettings }}
            />
          ) : (
            <EmptyState
              icon="cloud-offline-outline"
              title="Nothing to show"
              message="We couldn't load any stories. Check your connection and pull down to try again."
            />
          )
        ) : (
          <>
            <BriefingCard bullets={layout.bullets} slides={layout.slides} />

            <SectionHeader title="Top stories" onPress={() => openTopic('top')} />
            {layout.hero ? <StoryCard story={layout.hero} variant="overlay" /> : null}
            {layout.topRows.map((s: Story, i) => (
              <StoryCard key={s.id} story={s} index={i} />
            ))}
            <MoreLink label="More top stories" onPress={() => openTopic('top')} />

            {layout.forYou.length > 0 ? (
              <>
                <SectionHeader title="For you" subtitle="Newest from the sources you follow" />
                {layout.forYou.map((s, i) => (
                  <StoryCard key={s.id} story={s} index={i} />
                ))}
                <MoreLink label="More stories" onPress={() => openTopic('top')} />
              </>
            ) : null}
          </>
        )}
      </ScrollView>
      <ScrollTopButton visible={scrollTop.visible} onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} />
    </View>
  );
}
