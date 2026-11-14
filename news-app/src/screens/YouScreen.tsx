import { Ionicons } from '@expo/vector-icons';
import { useScrollToTop } from '@react-navigation/native';
import { useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
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
import { openAccount, openAuth, openBriefing, openRecap, openExplore, openRadar, openScores, openSettings, openWeather } from '../navigation';
import { useAccount } from '../state/AccountContext';
import { useSaved } from '../state/SavedContext';
import { useSettings } from '../state/SettingsContext';
import { TOPICS } from '../sources';
import { fonts, type, useTheme } from '../theme';
import { badges, bestStreak, lastWeek, streak } from '../services/activity';
import { timeAgo } from '../utils';

/** Days in a row with reading, this week's days, and (signed out) an offer to keep it safe. */
function StreakCard() {
  const c = useTheme();
  const account = useAccount();
  const { activity } = useSettings();
  const days = streak(activity.days);
  const best = bestStreak(activity.days);
  const week = lastWeek(activity.days);
  const unsafe = account.enabled && account.status === 'signedOut';
  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: days ? 'rgba(255,90,31,0.55)' : c.border, gap: 14 }]}>
      <View style={styles.between}>
        <Text style={[type.eyebrow, { color: c.accentText }]}>Reading streak</Text>
        {days ? (
          <View style={[styles.pill, { backgroundColor: c.elevated }]}>
            <Ionicons name="flame" size={13} color={c.accent} />
            <Text style={{ color: c.text, fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>{days >= 7 ? 'ON FIRE' : 'KEEP GOING'}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.streakRow}>
        <Text style={[styles.streakNum, { color: days ? c.accentText : c.tertiary }]}>{days}</Text>
        <Text style={[styles.streakLabel, { color: c.text }]}>{days === 1 ? 'day' : 'days'} in a row</Text>
      </View>
      <View style={styles.week}>
        {week.map((d) => (
          <View key={d.key} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View
              style={[
                styles.dayBox,
                d.done ? { backgroundColor: c.accent } : { borderColor: d.today ? c.accent : c.border, borderWidth: 1.5, borderStyle: d.today ? 'dashed' : 'solid' },
              ]}
            />
            <Text style={{ color: c.tertiary, fontSize: 11, fontWeight: '800' }}>{d.letter}</Text>
          </View>
        ))}
      </View>
      {unsafe ? (
        <>
          <Text style={{ color: c.secondary, fontSize: 15, lineHeight: 21 }}>
            Your streak only lives on this phone. <Text style={{ color: c.text, fontWeight: '800' }}>Sign up free to protect it</Text> and see it everywhere.
          </Text>
          <Pressable onPress={() => openAuth('signup')} style={[styles.wideBtn, { backgroundColor: c.accent }]} accessibilityRole="button">
            <Text style={[styles.btnText, { color: c.onAccent }]}>Protect my streak</Text>
          </Pressable>
        </>
      ) : (
        <Text style={{ color: c.secondary, fontSize: 14 }}>
          {days ? `Best ever: ${best} ${best === 1 ? 'day' : 'days'}. Read a story each day to keep it going.` : 'Read a story today to start a streak.'}
        </Text>
      )}
    </View>
  );
}

function Badges() {
  const c = useTheme();
  const account = useAccount();
  const { activity } = useSettings();
  const list = badges(activity);
  const earned = list.filter((b) => b.earned).length;
  return (
    <>
      <SectionHeader title="Badges" subtitle={`${earned} of ${list.length} earned${account.enabled && account.status === 'signedOut' ? ' · keep them with a free account' : ''}`} />
      <View style={styles.badges}>
        {list.map((b) => (
          <View key={b.id} style={[styles.badge, { backgroundColor: c.card, borderColor: b.earned ? b.color : c.border }]} accessibilityLabel={`${b.name}: ${b.earned ? 'earned' : b.how}`}>
            <View style={[styles.badgeIcon, { backgroundColor: b.earned ? b.color : c.elevated }]}>
              <Ionicons name={b.icon as keyof typeof Ionicons.glyphMap} size={22} color={b.earned ? '#0B0B0D' : c.tertiary} />
            </View>
            <Text style={[styles.badgeName, { color: b.earned ? c.text : c.secondary }]} numberOfLines={1}>
              {b.name}
            </Text>
            {b.earned ? (
              <Text style={{ color: c.tertiary, fontSize: 11 }} numberOfLines={2}>
                Earned
              </Text>
            ) : (
              <>
                <View style={[styles.bar, { backgroundColor: c.elevated }]}>
                  <View style={{ width: `${Math.round(b.progress * 100)}%`, height: 4, borderRadius: 2, backgroundColor: b.color }} />
                </View>
                <Text style={{ color: c.tertiary, fontSize: 11, textAlign: 'center' }} numberOfLines={2}>
                  {b.how}
                </Text>
              </>
            )}
          </View>
        ))}
      </View>
    </>
  );
}

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
  const { followed, favoriteTeams, activity } = useSettings();
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
          <StreakCard />
          <View style={styles.stats}>
            <Stat value={activity.read} label="Stories read" accent />
            <Stat value={saved.length} label="Saved" />
            <Stat value={favoriteTeams.length} label="Teams" onPress={openScores} />
          </View>
        </View>
        <View style={{ height: 10 }} />
        <Group>
          <LinkRow icon="headset-outline" label="Your briefing" onPress={openBriefing} />
          <LinkRow icon="moon-outline" label="Your day in news" onPress={openRecap} />
          <LinkRow icon="star-outline" label={`Topics you follow (${followed.length})`} onPress={openExplore} />
          <LinkRow icon="partly-sunny-outline" label="Weather" onPress={openWeather} />
          <LinkRow icon="rainy-outline" label="Rain radar" onPress={openRadar} />
          {Platform.OS === 'android' ? <LinkRow icon="apps-outline" label="Home screen widgets" onPress={openSettings} /> : null}
          <LinkRow icon="settings-outline" label="Settings" onPress={openSettings} last />
        </Group>

        <Badges />

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
  wideBtn: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 15, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, padding: 12 },
  statValue: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  streakRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  streakNum: { fontFamily: fonts.display, fontSize: 80, lineHeight: 82 },
  streakLabel: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 28, textTransform: 'uppercase' },
  week: { flexDirection: 'row', gap: 6 },
  dayBox: { alignSelf: 'stretch', height: 32, borderRadius: 10 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 14 },
  badge: { width: '30.5%', flexGrow: 1, alignItems: 'center', gap: 6, borderRadius: 18, borderWidth: 1.5, paddingVertical: 12, paddingHorizontal: 8 },
  badgeIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  badgeName: { fontSize: 13, fontWeight: '800' },
  bar: { alignSelf: 'stretch', height: 4, borderRadius: 2, overflow: 'hidden' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  linkText: { flex: 1, fontSize: 16, fontWeight: '700' },
});
