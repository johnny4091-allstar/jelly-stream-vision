import { Ionicons } from '@expo/vector-icons';
import { useScrollToTop } from '@react-navigation/native';
import { useRef, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
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
import { openAccount, openAuth, openExplore, openRadar, openScores, openSettings, openWeather } from '../navigation';
import { useAccount } from '../state/AccountContext';
import { useSaved } from '../state/SavedContext';
import { useSettings } from '../state/SettingsContext';
import { TOPICS } from '../sources';
import { fonts, type, useTheme } from '../theme';
import { timeAgo } from '../utils';

/** Who you are: signed-in account, or the reasons to make one. */
function AccountCard() {
  const c = useTheme();
  const account = useAccount();
  if (!account.enabled || account.status === 'loading') return null;
  if (account.status === 'signedIn') {
    return (
      <Pressable onPress={openAccount} accessibilityRole="button" accessibilityLabel="Account" style={[styles.card, styles.who, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={[styles.avatar, { backgroundColor: c.accent }]}>
          <Text style={[styles.avatarText, { color: c.onAccent }]}>{(account.email ?? '?')[0]!.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.email, { color: c.text }]} numberOfLines={1}>
            {account.email}
          </Text>
          <Text style={[type.caption, { color: account.syncError ? c.down : c.tertiary }]}>
            {account.syncError ? 'Sync problem' : account.lastSync ? `Synced ${timeAgo(account.lastSync).toLowerCase()}` : 'Syncing…'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={c.tertiary} />
      </Pressable>
    );
  }
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, gap: 12 }]}>
      <Text style={[styles.email, { color: c.text }]}>Create a free account</Text>
      <Text style={[type.body, { color: c.secondary }]}>Your saved stories, topics and teams on every phone.</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={() => openAuth('signup')} style={[styles.btn, { backgroundColor: c.accent }]} accessibilityRole="button">
          <Text style={[styles.btnText, { color: c.onAccent }]}>Create account</Text>
        </Pressable>
        <Pressable onPress={() => openAuth('signin')} style={[styles.btn, { backgroundColor: c.elevated, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth }]} accessibilityRole="button">
          <Text style={[styles.btnText, { color: c.text }]}>Sign in</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Stat({ value, label, onPress, accent }: { value: number; label: string; onPress?: () => void; accent?: boolean }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={[styles.card, styles.stat, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={[styles.statValue, { color: accent ? c.accentText : c.text }]}>{value}</Text>
      <Text style={[type.caption, { color: c.tertiary, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

function LinkRow({ icon, label, onPress, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; last?: boolean }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.linkRow, !last && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Ionicons name={icon} size={20} color={c.text} />
      <Text style={[styles.linkText, { color: c.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={c.tertiary} />
    </Pressable>
  );
}

function Group({ children }: { children: ReactNode }) {
  const c = useTheme();
  return <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, paddingVertical: 4, marginHorizontal: 14 }]}>{children}</View>;
}

const SAVED_PREVIEW = 5;

/** Account, your numbers, shortcuts, saved stories, then a section for each followed topic. */
export function YouScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarSpace();
  const { saved } = useSaved();
  const { followed, favoriteTeams } = useSettings();
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
        <AppHeader title="You" hideWeather />
        <View style={{ paddingHorizontal: 14, gap: 10 }}>
          <AccountCard />
          <View style={styles.stats}>
            <Stat value={saved.length} label="Saved" accent />
            <Stat value={followed.length} label="Topics" onPress={openExplore} />
            <Stat value={favoriteTeams.length} label="Teams" onPress={openScores} />
          </View>
        </View>
        <View style={{ height: 10 }} />
        <Group>
          <LinkRow icon="partly-sunny-outline" label="Weather" onPress={openWeather} />
          <LinkRow icon="rainy-outline" label="Rain radar" onPress={openRadar} />
          <LinkRow icon="settings-outline" label="Settings" onPress={openSettings} last />
        </Group>

        <SectionHeader title="Saved" subtitle={saved.length ? `${saved.length} saved stories` : undefined} />
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
              message="Tap Follow on any topic in Explore and it shows up here."
              action={{ label: 'Go to Explore', onPress: openExplore }}
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

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34 },
  email: { fontSize: 17, fontWeight: '800' },
  btn: { flex: 1, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 15, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, padding: 12 },
  statValue: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  linkText: { flex: 1, fontSize: 16, fontWeight: '700' },
});
