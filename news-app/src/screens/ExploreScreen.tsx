import { Ionicons } from '@expo/vector-icons';
import { useScrollToTop } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, EmptyState, ScrollTopButton, SectionHeader, useScrollTopVisibility, useTabBarSpace } from '../components/common';
import { StoryCard } from '../components/StoryCard';
import { TopicSection } from '../components/TopicSection';
import { openTopic } from '../navigation';
import { cachedStories } from '../services/news';
import { TOPICS } from '../sources';
import { useSettings } from '../state/SettingsContext';
import { fonts, useTheme } from '../theme';

const MAX_RESULTS = 40;

/** Stories already loaded whose headline, summary or outlet has every word typed. */
function search(query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return cachedStories()
    .filter((s) => {
      const text = `${s.title} ${s.summary} ${s.sourceName}`.toLowerCase();
      return words.every((w) => text.includes(w));
    })
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, MAX_RESULTS);
}

/** Search, colour-coded topic tiles, then every topic as a section. */
export function ExploreScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarSpace();
  const { isFollowing } = useSettings();
  const [query, setQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  useScrollToTop(scrollRef);
  const scrollTop = useScrollTopVisibility();
  const searching = query.trim().length >= 2;
  const results = useMemo(() => (searching ? search(query.trim()) : []), [query, searching]);

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
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: bottom }}
        keyboardShouldPersistTaps="handled"
        onScroll={scrollTop.onScroll}
        scrollEventThrottle={scrollTop.scrollEventThrottle}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.tertiary} progressViewOffset={insets.top} />
        }
      >
        <AppHeader title="Explore" />
        <View style={[styles.search, { backgroundColor: c.card, borderColor: c.border }]}>
          <Ionicons name="search" size={19} color={c.tertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search stories and sources"
            placeholderTextColor={c.tertiary}
            style={[styles.searchInput, { color: c.text }]}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search stories"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={19} color={c.tertiary} />
            </Pressable>
          ) : null}
        </View>

        {searching ? (
          <>
            <SectionHeader title={`${results.length || 'No'} ${results.length === 1 ? 'result' : 'results'}`} subtitle="From the stories loaded in the app" />
            {results.length === 0 ? (
              <EmptyState icon="search" title="Nothing found" message="Try another word, or pull down to load the latest stories." />
            ) : (
              results.map((s, i) => <StoryCard key={s.id} story={s} index={i} />)
            )}
          </>
        ) : (
          <>
            <SectionHeader title="Topics" />
            <View style={styles.grid}>
              {TOPICS.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    openTopic(t.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t.title}
                  style={({ pressed }) => [
                    styles.topic,
                    { backgroundColor: c.card, borderColor: isFollowing(t.id) ? t.color : c.border, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <View style={[styles.badge, { backgroundColor: t.color }]}>
                    <Ionicons name={t.icon as keyof typeof Ionicons.glyphMap} size={18} color="#0B0B0D" />
                  </View>
                  <Text style={[styles.topicName, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {t.id === 'top' ? 'Top stories' : t.label}
                  </Text>
                  {isFollowing(t.id) ? <Ionicons name="star" size={14} color={t.color} /> : null}
                </Pressable>
              ))}
            </View>
            {TOPICS.map((t) => (
              <TopicSection key={t.id} topic={t.id} refreshToken={refreshKey} />
            ))}
          </>
        )}
      </ScrollView>
      <ScrollTopButton visible={scrollTop.visible} onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} />
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, paddingVertical: 13, fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 14 },
  topic: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 12,
  },
  badge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  topicName: { flex: 1, fontFamily: fonts.heading, fontSize: 21, lineHeight: 24, textTransform: 'uppercase' },
});
