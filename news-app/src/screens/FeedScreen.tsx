import { useScrollToTop } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View, type ListRenderItem } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, FailedNotice, ScreenHeader, SkeletonCard } from '../components/common';
import { StoryCard } from '../components/StoryCard';
import { TopicChips } from '../components/TopicChips';
import { useSettings } from '../state/SettingsContext';
import { useStories } from '../state/useStories';
import { useTheme } from '../theme';
import type { Story, Topic } from '../types';

export function FeedScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const [topic, setTopic] = useState<Topic>('top');
  const { stories, failed, loading, refreshing, refresh } = useStories(topic);
  const { enabledSources } = useSettings();
  const listRef = useRef<FlatList<Story>>(null);
  useScrollToTop(listRef);

  const changeTopic = useCallback((t: Topic) => {
    setTopic(t);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const renderItem = useCallback<ListRenderItem<Story>>(
    ({ item, index }) => <StoryCard story={item} variant={index === 0 ? 'hero' : 'standard'} index={index} />,
    [],
  );

  const showSkeleton = loading && stories.length === 0;

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <FlatList
        ref={listRef}
        data={showSkeleton ? [] : stories}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 24 }}
        ListHeaderComponent={
          <>
            <ScreenHeader
              title="Feed"
              right={loading && stories.length > 0 ? <ActivityIndicator color={c.tertiary} /> : null}
            />
            <TopicChips value={topic} onChange={changeTopic} />
            <FailedNotice failed={failed} />
            {showSkeleton ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : null}
          </>
        }
        ListEmptyComponent={
          showSkeleton ? undefined : enabledSources.length === 0 ? (
            <EmptyState icon="newspaper-outline" title="No sources on" message="Turn on a few outlets in Settings." />
          ) : (
            <EmptyState
              icon="cloud-offline-outline"
              title="Nothing to show"
              message="We couldn't load any stories. Check your connection and pull down to try again."
            />
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.tertiary} progressViewOffset={insets.top} />
        }
        initialNumToRender={5}
        maxToRenderPerBatch={6}
        windowSize={9}
        removeClippedSubviews
      />
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
