import { useScrollToTop } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { RefreshControl, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, ScrollTopButton, useScrollTopVisibility, useTabBarSpace } from '../components/common';
import { TopicChips } from '../components/TopicChips';
import { TopicSection } from '../components/TopicSection';
import { TOPICS } from '../sources';
import { useTheme } from '../theme';
import type { Topic } from '../types';

const CHIPS_HEIGHT = 64;

/** Every topic as a section. The chips stay pinned at the top and jump to a section. */
export function NewsScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarSpace();
  const [active, setActive] = useState<Topic>('top');
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const offsets = useRef<Partial<Record<Topic, number>>>({});
  const scrollRef = useRef<ScrollViewInstance>(null);
  useScrollToTop(scrollRef);
  const scrollTop = useScrollTopVisibility();

  const jump = (topic: Topic) => {
    setActive(topic);
    const y = offsets.current[topic];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - CHIPS_HEIGHT), animated: true });
  };

  // Each section refetches when the token changes; the spinner is just feedback.
  const refresh = () => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 1200);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: bottom }}
        onScroll={(e) => {
          scrollTop.onScroll(e);
          const y = e.nativeEvent.contentOffset.y + CHIPS_HEIGHT + 40;
          let current: Topic = 'top';
          for (const t of TOPICS) {
            const top = offsets.current[t.id];
            if (top !== undefined && top <= y) current = t.id;
          }
          if (current !== active) setActive(current);
        }}
        scrollEventThrottle={64}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.tertiary} progressViewOffset={insets.top} />
        }
      >
        <AppHeader />
        <TopicChips value={active} onChange={jump} />
        {TOPICS.map((t) => (
          <View key={t.id} onLayout={(e) => (offsets.current[t.id] = e.nativeEvent.layout.y)}>
            <TopicSection topic={t.id} refreshToken={refreshKey} />
          </View>
        ))}
      </ScrollView>
      <ScrollTopButton visible={scrollTop.visible} onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} />
    </View>
  );
}
