import { useScrollToTop } from '@react-navigation/native';
import { useCallback, useRef, type ReactElement } from 'react';
import { FlatList, RefreshControl, View, type ListRenderItem } from 'react-native';

import { useSettings } from '../state/SettingsContext';
import { useStories } from '../state/useStories';
import { useTheme } from '../theme';
import type { Story, Topic } from '../types';
import { EmptyState, FailedNotice, ScrollTopButton, SkeletonCard, useScrollTopVisibility } from './common';
import { StoryCard } from './StoryCard';

/**
 * Every story in one topic: the first with a picture as a big image card, the rest as rows.
 * Used by the Sports tab and the "More … stories" screens.
 */
export function TopicFeed({
  topic,
  header,
  paddingTop,
  paddingBottom,
}: {
  topic: Topic;
  header: ReactElement;
  paddingTop: number;
  paddingBottom: number;
}) {
  const c = useTheme();
  const { stories, failed, loading, refreshing, refresh } = useStories(topic);
  const { enabledSources } = useSettings();
  const listRef = useRef<FlatList<Story>>(null);
  useScrollToTop(listRef);
  const scrollTop = useScrollTopVisibility();

  const heroIndex = stories.findIndex((s) => s.imageUrl);
  const ordered = heroIndex > 0 ? [stories[heroIndex]!, ...stories.filter((_, i) => i !== heroIndex)] : stories;

  const renderItem = useCallback<ListRenderItem<Story>>(
    ({ item, index }) => (
      <StoryCard story={item} variant={index === 0 && item.imageUrl ? 'overlay' : 'row'} index={index} />
    ),
    [],
  );
  const showSkeleton = loading && stories.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <FlatList
        ref={listRef}
        data={showSkeleton ? [] : ordered}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop, paddingBottom }}
        onScroll={scrollTop.onScroll}
        scrollEventThrottle={scrollTop.scrollEventThrottle}
        ListHeaderComponent={
          <>
            {header}
            <FailedNotice failed={failed} />
            {showSkeleton ? (
              <>
                <SkeletonCard hero />
                <SkeletonCard />
              </>
            ) : null}
          </>
        }
        ListEmptyComponent={
          showSkeleton ? undefined : (
            <EmptyState
              icon={enabledSources.length === 0 ? 'newspaper-outline' : 'cloud-offline-outline'}
              title={enabledSources.length === 0 ? 'No sources on' : 'Nothing to show'}
              message={
                enabledSources.length === 0
                  ? 'Turn on a few outlets in Settings.'
                  : "None of your sources have stories here right now. Pull down to try again."
              }
            />
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.tertiary} progressViewOffset={paddingTop} />
        }
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={9}
        removeClippedSubviews
      />
      <ScrollTopButton visible={scrollTop.visible} onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} />
    </View>
  );
}
