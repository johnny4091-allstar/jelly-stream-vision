import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoogleButton } from '../components/AccountPrompts';
import { showBackgroundGuideOnce } from '../components/BackgroundGuide';
import { openAuth, type OnboardingScreenProps } from '../navigation';
import { pickTopStories } from '../services/news';
import { setUpNotifications, syncBriefingAlert } from '../services/notifications';
import { TEAM_LEAGUES, fetchTeams, type TeamInfo } from '../services/scores';
import type { TempUnit } from '../services/weather';
import { TOPICS } from '../sources';
import { useAccount } from '../state/AccountContext';
import { useSettings } from '../state/SettingsContext';
import { useStories } from '../state/useStories';
import { useWeather } from '../state/WeatherContext';
import { useCoverage } from './CoverageScreen';
import { HAMMER, fonts, type, useTheme } from '../theme';

export const ONBOARDING_KEY = 'onboarding:v1';
/** Welcome, four setup steps, then the summary. */
const STEPS = 6;
const SETUP_STEPS = 4;
type IconName = keyof typeof Ionicons.glyphMap;

type SlideProps = { width: number; height: number };

/** Slide 1: today's real top story, with how many outlets have it. */
function CoverageSlide({ width, height }: SlideProps) {
  const { stories } = useStories('top');
  const lead = useMemo(() => {
    const withImages = stories.filter((s) => s.imageUrl);
    return pickTopStories(withImages.length ? withImages : stories, 1)[0];
  }, [stories]);
  const coverage = useCoverage(lead);
  return (
    <View style={[styles.slide, { width, height }]}>
      <View style={styles.art}>
        <View style={[styles.stackCard, { transform: [{ rotate: '-6deg' }], top: 34, left: 28, right: 28 }]} />
        <View style={[styles.stackCard, { transform: [{ rotate: '3deg' }], top: 18, left: 14, right: 14, backgroundColor: '#19191D' }]} />
        <View style={styles.storyCard}>
          <View style={styles.storyImage}>
            {lead?.imageUrl ? <Image source={{ uri: lead.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} /> : null}
            <View style={styles.breaking}>
              <Text style={styles.breakingText}>Top story</Text>
            </View>
          </View>
          <View style={{ padding: 14, gap: 8 }}>
            <Text style={styles.storyTitle} numberOfLines={3}>
              {lead?.title ?? 'Today’s biggest story, from every side'}
            </Text>
            <View style={styles.between}>
              <Text style={styles.storyMeta} numberOfLines={1}>
                {lead ? coverage.stories.slice(0, 3).map((s) => s.sourceName).join(' · ') : 'BBC · AP · Reuters'}
              </Text>
              <Text style={styles.outlets}>{lead ? `${Math.max(1, coverage.outlets)} ${coverage.outlets > 1 ? 'outlets' : 'outlet'}` : '14 outlets'}</Text>
            </View>
          </View>
        </View>
      </View>
      <Text style={styles.slideTitle}>
        Every side.{'\n'}
        <Text style={{ color: HAMMER }}>One swipe.</Text>
      </Text>
      <Text style={styles.slideSub}>See how 50 outlets cover the same story, side by side, in seconds.</Text>
    </View>
  );
}

/** Slide 2: what the Today screen becomes once it's set up. */
function PersonalSlide({ width, height }: SlideProps) {
  return (
    <View style={[styles.slide, { width, height }]}>
      <View style={styles.tiles}>
        <View style={[styles.tile, { backgroundColor: '#16233F', borderColor: '#22345A' }]}>
          <Text style={[styles.tileLabel, { color: '#A9BBDB' }]}>Your city</Text>
          <Text style={styles.tileBig}>61°</Text>
          <Text style={[styles.tileSmall, { color: '#CFE0FF' }]}>Rain at 4 PM</Text>
        </View>
        <View style={[styles.tile, { borderColor: 'rgba(255,90,31,0.6)' }]}>
          <Text style={styles.tileLabel}>Your team</Text>
          <Text style={styles.tileScore}>
            BKN 101{'\n'}
            <Text style={{ color: '#8A8A93' }}>CHA 94</Text>
          </Text>
          <Text style={[styles.tileSmall, { color: HAMMER }]}>● Q4 2:11</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileLabel}>Your markets</Text>
          <Ionicons name="trending-up" size={42} color="#3FD07A" />
          <Text style={[styles.tileScore, { color: '#3FD07A' }]}>▲ 0.62%</Text>
        </View>
        <View style={[styles.tile, { backgroundColor: HAMMER, borderColor: HAMMER }]}>
          <Text style={[styles.tileLabel, { color: '#120600' }]}>Your briefing</Text>
          <Text style={[styles.tileScore, { color: '#120600' }]}>▶ Ready{'\n'}at 7 AM</Text>
        </View>
      </View>
      <Text style={styles.slideTitle}>
        Built around{'\n'}
        <Text style={{ color: '#5CC8FF' }}>you.</Text>
      </Text>
      <Text style={styles.slideSub}>Your weather, your teams, your topics, waiting every morning.</Text>
    </View>
  );
}

/** Slide 3: why make an account (or, without accounts, what's free). */
function JoinSlide({ width, height }: SlideProps) {
  const account = useAccount();
  const perks: [IconName, string, string, string][] = account.enabled
    ? [
        ['bookmark-outline', HAMMER, 'Saved stories on every phone', 'Switch phones, lose nothing'],
        ['star-outline', '#FFC53D', 'Your teams and topics, synced', 'Set up once, done everywhere'],
        ['flame-outline', '#F472B6', 'Keep your reading streak', 'Badges and stats that follow you'],
        ['lock-closed-outline', '#5CC8FF', 'Private by design', 'Only your email. Never sold or shared'],
      ]
    : [
        ['newspaper-outline', HAMMER, '50 trusted sources', 'Every side of every story'],
        ['trophy-outline', '#FFC53D', 'Live scores for your teams', 'Starred teams first, live'],
        ['headset-outline', '#F472B6', 'A morning briefing', 'Listen in 6 minutes'],
        ['lock-closed-outline', '#5CC8FF', 'Private by design', 'Everything stays on your phone'],
      ];
  return (
    <View style={[styles.slide, { width, height, justifyContent: 'center' }]}>
      <Image source={require('../../assets/icon.png')} style={styles.joinLogo} />
      <Text style={styles.slideTitle}>
        Free. Forever.{'\n'}
        <Text style={{ color: HAMMER }}>{account.enabled ? 'Takes 10 seconds.' : 'No sign-up needed.'}</Text>
      </Text>
      <View style={{ gap: 14, marginTop: 6 }}>
        {perks.map(([icon, color, title, sub]) => (
          <View key={title} style={styles.perk}>
            <View style={[styles.perkIcon, { backgroundColor: `${color}26` }]}>
              <Ionicons name={icon} size={20} color={color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.perkTitle}>{title}</Text>
              <Text style={styles.perkSub}>{sub}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const SLIDES = [CoverageSlide, PersonalSlide, JoinSlide];

/** Three swipeable welcome slides; the last one offers sign-up. */
function Welcome({ onNext }: { onNext: () => void }) {
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const [height, setHeight] = useState(0);
  const list = useRef<FlatList<(typeof SLIDES)[number]>>(null);
  const last = page === SLIDES.length - 1;
  const go = (i: number) => {
    Haptics.selectionAsync().catch(() => {});
    list.current?.scrollToIndex({ index: i, animated: true });
    setPage(i);
  };
  const tint = page === 1 ? '#0F2A3A' : '#3A1608';
  const dot = page === 1 ? '#5CC8FF' : HAMMER;

  return (
    <LinearGradient colors={[tint, '#0B0B0D']} locations={[0, 0.6]} style={[styles.flex, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 18 }]}>
      <StatusBar style="light" />
      <View style={styles.welcomeBar}>
        <Text style={[styles.brand, { color: dot }]}>News Hammer</Text>
        {last ? null : (
          <Pressable onPress={() => go(SLIDES.length - 1)} hitSlop={10} accessibilityRole="button">
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        ref={list}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item: Slide }) => (height ? <Slide width={width} height={height} /> : null)}
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
        style={styles.flex}
      />
      <View style={styles.welcomeButtons}>
        <View style={styles.pageDots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.pageDot, i === page && { width: 24, backgroundColor: dot }]} />
          ))}
        </View>
        {!last ? (
          <Pressable onPress={() => go(page + 1)} style={[styles.bigBtn, { backgroundColor: HAMMER }]} accessibilityRole="button">
            <Text style={[styles.bigBtnText, { color: '#120600' }]}>Next</Text>
          </Pressable>
        ) : account.enabled ? (
          <>
            <GoogleButton />
            <Pressable onPress={() => openAuth('signup', 'back')} style={[styles.bigBtn, { backgroundColor: HAMMER }]} accessibilityRole="button">
              <Text style={[styles.bigBtnText, { color: '#120600' }]}>Sign up with email</Text>
            </Pressable>
            <View style={styles.joinLinks}>
              <Pressable onPress={() => openAuth('signin', 'back')} hitSlop={8} accessibilityRole="button">
                <Text style={styles.ghostText}>
                  Already a member? <Text style={{ color: HAMMER }}>Sign in</Text>
                </Text>
              </Pressable>
              <Text style={styles.ghostText}>·</Text>
              <Pressable onPress={onNext} hitSlop={8} accessibilityRole="button">
                <Text style={styles.ghostText}>Maybe later</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Pressable onPress={onNext} style={[styles.bigBtn, { backgroundColor: HAMMER }]} accessibilityRole="button">
            <Text style={[styles.bigBtnText, { color: '#120600' }]}>Get started</Text>
          </Pressable>
        )}
      </View>
    </LinearGradient>
  );
}

function StepHeader({ title, sub }: { title: string; sub: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: 10, marginBottom: 20 }}>
      <Text style={[styles.stepTitle, { color: c.text }]}>{title}</Text>
      <Text style={[styles.stepSub, { color: c.secondary }]}>{sub}</Text>
    </View>
  );
}

function Topics() {
  const c = useTheme();
  const { isFollowing, setFollowing } = useSettings();
  return (
    <>
      <StepHeader title="What do you care about?" sub="Pick a few. They get their own sections on the You tab." />
      <View style={styles.topicGrid}>
        {TOPICS.map((t) => {
          const on = isFollowing(t.id);
          return (
            <Pressable
              key={t.id}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setFollowing(t.id, !on);
              }}
              style={[styles.topic, { backgroundColor: on ? `${t.color}22` : c.card, borderColor: on ? t.color : c.border }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={t.title}
            >
              <Ionicons name={t.icon as IconName} size={19} color={t.color} />
              <Text style={[styles.topicText, { color: c.text }]} numberOfLines={1}>
                {t.id === 'top' ? 'Top stories' : t.label}
              </Text>
              <View style={[styles.check, on ? { backgroundColor: t.color, borderColor: t.color } : { borderColor: c.border }]}>
                {on ? <Ionicons name="checkmark" size={14} color="#0B0B0D" /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

function Teams() {
  const c = useTheme();
  const { favoriteTeams, toggleFavoriteTeam } = useSettings();
  const [league, setLeague] = useState(TEAM_LEAGUES[0]!.id);
  const [teams, setTeams] = useState<Record<string, TeamInfo[] | null>>({});
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (teams[league] !== undefined) return;
    const l = TEAM_LEAGUES.find((x) => x.id === league)!;
    setTeams((t) => ({ ...t, [league]: null }));
    fetchTeams(l)
      .then((list) => setTeams((t) => ({ ...t, [league]: list })))
      .catch(() => setTeams((t) => ({ ...t, [league]: [] })));
  }, [league, teams]);

  const list = teams[league];
  const shown = useMemo(
    () => (list ?? []).filter((t) => !query || t.name.toLowerCase().includes(query.toLowerCase()) || t.abbr.toLowerCase() === query.toLowerCase()),
    [list, query],
  );

  return (
    <>
      <StepHeader title="Your teams" sub="Star your teams. Their games show first, big and live, on the Scores tab." />
      <View style={[styles.search, { backgroundColor: c.card, borderColor: c.border }]}>
        <Ionicons name="search" size={18} color={c.tertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search teams"
          placeholderTextColor={c.tertiary}
          style={[styles.searchInput, { color: c.text }]}
          accessibilityLabel="Search teams"
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
        {TEAM_LEAGUES.map((l) => {
          const active = l.id === league;
          return (
            <Pressable
              key={l.id}
              onPress={() => setLeague(l.id)}
              style={[styles.chip, { backgroundColor: active ? c.chipActive : c.chip, borderColor: active ? c.chipActive : c.border }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={{ color: active ? c.chipActiveText : c.chipText, fontWeight: '800' }}>{l.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {list === null || list === undefined ? <ActivityIndicator style={{ marginTop: 24 }} color={c.tertiary} /> : null}
      {list && list.length === 0 ? <Text style={{ color: c.secondary, marginTop: 16 }}>Couldn’t load teams. You can star teams later on the Scores tab.</Text> : null}
      <View style={styles.teamGrid}>
        {shown.map((t) => {
          const on = favoriteTeams.includes(t.abbr);
          return (
            <Pressable
              key={`${t.league}:${t.abbr}`}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                toggleFavoriteTeam(t.abbr);
              }}
              style={[styles.team, { backgroundColor: on ? `${HAMMER}1A` : c.card, borderColor: on ? HAMMER : c.border }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={t.name}
            >
              {on ? <Ionicons name="star" size={14} color={HAMMER} style={styles.teamStar} /> : null}
              {t.logo ? <Image source={{ uri: t.logo }} style={styles.teamLogo} contentFit="contain" /> : <View style={styles.teamLogo} />}
              <Text style={[styles.teamName, { color: on ? c.text : c.secondary }]} numberOfLines={2}>
                {t.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

function Weather() {
  const c = useTheme();
  const { tempUnit, setTempUnit } = useSettings();
  const { access, weather, enable } = useWeather();
  const allowed = access === 'granted';
  return (
    <>
      <StepHeader title="Local weather & radar" sub="The forecast, live rain radar and conditions where you are. Your location stays on your phone; only a rough area is used for the forecast." />
      <View style={[styles.wxCard, { backgroundColor: '#16233F', borderColor: '#22345A' }]}>
        <Ionicons name={allowed ? 'location' : 'partly-sunny'} size={34} color="#5CC8FF" />
        <View style={{ flex: 1 }}>
          <Text style={styles.wxTitle}>{allowed ? weather?.place || 'Location on' : 'See your weather'}</Text>
          <Text style={styles.wxSub}>{allowed ? 'Your forecast is ready on Today.' : 'Temperature, rain radar and a 7-day forecast.'}</Text>
        </View>
      </View>
      <Pressable
        onPress={enable}
        disabled={allowed}
        style={[styles.bigBtn, { backgroundColor: allowed ? c.card : c.accent, marginTop: 14 }]}
        accessibilityRole="button"
      >
        <Text style={[styles.bigBtnText, { color: allowed ? c.text : c.onAccent }]}>
          {allowed ? '✓ Location on' : access === 'blocked' ? 'Open settings to allow location' : 'Use my location'}
        </Text>
      </Pressable>
      <Text style={[type.eyebrow, { color: c.tertiary, marginTop: 24, marginBottom: 8 }]}>Temperature</Text>
      <View style={[styles.segment, { backgroundColor: c.card, borderColor: c.border }]}>
        {(['f', 'c'] as TempUnit[]).map((u) => {
          const active = u === tempUnit;
          return (
            <Pressable key={u} onPress={() => setTempUnit(u)} style={[styles.segmentItem, active && { backgroundColor: c.chipActive }]} accessibilityRole="radio" accessibilityState={{ selected: active }}>
              <Text style={{ color: active ? c.chipActiveText : c.chipText, fontWeight: '800', fontSize: 16 }}>{u === 'f' ? '°F' : '°C'}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

function Notifications({ granted, onAsk }: { granted: boolean | null; onAsk: () => void }) {
  const c = useTheme();
  return (
    <>
      <StepHeader title="Stay in the know" sub="A buzz when big stories break, and when a new version of the app is ready. Change it any time in Settings." />
      <View style={[styles.notif, { backgroundColor: c.elevated, borderColor: c.border }]}>
        <Image source={require('../../assets/icon.png')} style={styles.notifIcon} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: '800' }}>Breaking · News Hammer</Text>
          <Text style={{ color: c.secondary, fontSize: 13 }} numberOfLines={2}>
            The biggest stories, the moment they break.
          </Text>
        </View>
        <Text style={{ color: c.tertiary, fontSize: 12 }}>now</Text>
      </View>
      <Pressable onPress={onAsk} disabled={granted === true} style={[styles.bigBtn, { backgroundColor: granted ? c.card : c.accent, marginTop: 16 }]} accessibilityRole="button">
        <Text style={[styles.bigBtnText, { color: granted ? c.text : c.onAccent }]}>
          {granted ? '✓ Notifications on' : granted === false ? 'Notifications are off. Try again' : 'Turn on notifications'}
        </Text>
      </Pressable>
    </>
  );
}

/** The last screen: everything picked, before the app opens. */
function Done({ notifications }: { notifications: boolean | null }) {
  const c = useTheme();
  const { followed, favoriteTeams, tempUnit } = useSettings();
  const { access, weather } = useWeather();
  const topics = TOPICS.filter((t) => followed.includes(t.id)).map((t) => (t.id === 'top' ? 'Top stories' : t.label));
  const rows: [string, string][] = [
    ['Topics', topics.length ? topics.join(', ') : 'None yet'],
    ['Teams', favoriteTeams.length ? favoriteTeams.map((t) => `★ ${t}`).join('  ') : 'None yet'],
    ['Weather', access === 'granted' ? `${weather?.place || 'On'} · °${tempUnit.toUpperCase()}` : 'Off'],
    ['Alerts', notifications ? 'Breaking news · 7 AM briefing' : 'Off'],
  ];
  return (
    <View style={{ alignItems: 'center', gap: 16, paddingTop: 30 }}>
      <View style={[styles.doneRing, { backgroundColor: c.accent, shadowColor: c.accent }]}>
        <Ionicons name="checkmark" size={52} color={c.onAccent} />
      </View>
      <Text style={[styles.stepTitle, { color: c.text, textAlign: 'center', marginTop: 8 }]}>You’re all set</Text>
      <Text style={[styles.stepSub, { color: c.secondary, textAlign: 'center' }]}>Your Today screen is ready, built from what you picked.</Text>
      <View style={[styles.summary, { backgroundColor: c.card, borderColor: c.border }]}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.summaryRow}>
            <Text style={[type.eyebrow, { color: c.tertiary, width: 70 }]}>{label}</Text>
            <Text style={{ color: c.text, fontSize: 14, fontWeight: '700', flex: 1 }}>{value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** First-launch setup: welcome (with sign-up / sign-in), topics, teams, weather, notifications, done. */
export function OnboardingScreen({ navigation }: OnboardingScreenProps) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const { followed } = useSettings();
  const [step, setStep] = useState(0);
  const [notifications, setNotifications] = useState<boolean | null>(null);

  // Signed up or in from the welcome screen: carry on with setup.
  useEffect(() => {
    if (step === 0 && account.status === 'signedIn') setStep(1);
  }, [account.status, step]);

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1').catch(() => {});
    if (notifications) showBackgroundGuideOnce().catch(() => {});
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  };
  const next = () => (step >= STEPS - 1 ? finish() : setStep((s) => s + 1));

  if (step === 0) return <Welcome onNext={next} />;

  const askNotifications = async () => {
    const granted = await setUpNotifications().catch(() => false);
    setNotifications(granted);
    if (granted && (!account.enabled || account.status === 'signedIn')) syncBriefingAlert(true).catch(() => {});
  };
  const done = step === STEPS - 1;

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}>
      {done ? null : (
        <>
          <View style={styles.progress}>
            {Array.from({ length: SETUP_STEPS }, (_, i) => (
              <View key={i} style={[styles.progressSeg, { backgroundColor: i < step ? c.accent : c.border }]} />
            ))}
          </View>
          <View style={styles.topBar}>
            <Pressable onPress={() => setStep((s) => s - 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={styles.backRow}>
              <Ionicons name="chevron-back" size={20} color={c.secondary} />
              <Text style={{ color: c.secondary, fontWeight: '700', fontSize: 14 }}>
                Step {step} of {SETUP_STEPS}
              </Text>
            </Pressable>
            <Pressable onPress={next} hitSlop={10} accessibilityRole="button">
              <Text style={{ color: c.secondary, fontWeight: '700', fontSize: 15 }}>Skip</Text>
            </Pressable>
          </View>
        </>
      )}
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {step === 1 ? <Topics /> : step === 2 ? <Teams /> : step === 3 ? <Weather /> : step === 4 ? <Notifications granted={notifications} onAsk={askNotifications} /> : <Done notifications={notifications} />}
      </ScrollView>
      <View style={{ padding: 16, paddingBottom: insets.bottom + 16 }}>
        <Pressable onPress={next} style={[styles.bigBtn, { backgroundColor: done || step === 1 ? c.accent : c.chipActive }]} accessibilityRole="button">
          <Text style={[styles.bigBtnText, { color: done || step === 1 ? c.onAccent : c.chipActiveText }]}>
            {done ? 'Start reading' : step === 1 && followed.length ? `Continue · ${followed.length} picked` : 'Continue'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  welcomeBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 6 },
  brand: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase' },
  skip: { color: '#B4B4BC', fontSize: 15, fontWeight: '700' },
  slide: { paddingHorizontal: 20, justifyContent: 'flex-end', gap: 16, paddingBottom: 10 },
  art: { height: 320 },
  stackCard: { position: 'absolute', height: 250, borderRadius: 22, backgroundColor: '#1C1C21', borderWidth: StyleSheet.hairlineWidth, borderColor: '#2A2A31' },
  storyCard: { position: 'absolute', left: 0, right: 0, top: 0, borderRadius: 22, overflow: 'hidden', backgroundColor: '#151518', borderWidth: StyleSheet.hairlineWidth, borderColor: '#2A2A31' },
  storyImage: { height: 150, backgroundColor: '#2E3A45' },
  breaking: { position: 'absolute', left: 12, top: 12, backgroundColor: HAMMER, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  breakingText: { color: '#120600', fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  storyTitle: { color: '#F5F5F7', fontFamily: fonts.heading, fontSize: 25, lineHeight: 26 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  storyMeta: { color: '#B4B4BC', fontSize: 12, fontWeight: '600', flex: 1 },
  outlets: { color: HAMMER, fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  slideTitle: { color: '#F5F5F7', fontFamily: fonts.display, fontSize: 50, lineHeight: 50, textTransform: 'uppercase' },
  slideSub: { color: '#B4B4BC', fontSize: 16, lineHeight: 23 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', flexGrow: 1, height: 150, borderRadius: 22, borderWidth: 1, borderColor: '#2A2A31', backgroundColor: '#151518', padding: 14, justifyContent: 'space-between' },
  tileLabel: { color: '#B4B4BC', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  tileBig: { color: '#F5F5F7', fontFamily: fonts.display, fontSize: 56, lineHeight: 58 },
  tileScore: { color: '#F5F5F7', fontFamily: fonts.heading, fontSize: 25, lineHeight: 26, textTransform: 'uppercase' },
  tileSmall: { fontSize: 13, fontWeight: '700' },
  joinLogo: { width: 88, height: 88, borderRadius: 22 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  perkIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  perkTitle: { color: '#F5F5F7', fontSize: 15, fontWeight: '800' },
  perkSub: { color: '#8A8A93', fontSize: 13, marginTop: 1 },
  welcomeButtons: { paddingHorizontal: 20, gap: 10, paddingTop: 10 },
  pageDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 6 },
  pageDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2A2A31' },
  joinLinks: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  bigBtn: { borderRadius: 16, height: 54, alignItems: 'center', justifyContent: 'center' },
  darkBtn: { backgroundColor: '#1E1E23', borderWidth: StyleSheet.hairlineWidth, borderColor: '#2A2A31' },
  bigBtnText: { color: '#F5F5F7', fontSize: 16, fontWeight: '800' },
  ghostBtn: { paddingVertical: 12, alignItems: 'center' },
  ghostText: { color: '#B4B4BC', fontSize: 15, fontWeight: '700' },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingTop: 14 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  stepTitle: { fontFamily: fonts.display, fontSize: 44, lineHeight: 44, textTransform: 'uppercase' },
  stepSub: { fontSize: 16, lineHeight: 23 },
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  topic: { width: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 15 },
  topicText: { fontSize: 15, fontWeight: '800', flex: 1 },
  check: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  chip: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 15, paddingVertical: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16 },
  teamGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  team: { width: '30.5%', flexGrow: 1, alignItems: 'center', gap: 6, borderRadius: 18, borderWidth: 1.5, paddingVertical: 12, paddingHorizontal: 6 },
  teamStar: { position: 'absolute', top: 7, right: 8 },
  teamLogo: { width: 46, height: 46 },
  teamName: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  wxCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 22, borderWidth: 1, padding: 18 },
  wxTitle: { color: '#F5F5F7', fontFamily: fonts.heading, fontSize: 24, lineHeight: 26 },
  wxSub: { color: '#CFE0FF', fontSize: 14, marginTop: 2 },
  segment: { flexDirection: 'row', padding: 4, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 999 },
  notif: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  notifIcon: { width: 36, height: 36, borderRadius: 9 },
  doneRing: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.5, shadowRadius: 24, elevation: 12 },
  summary: { alignSelf: 'stretch', borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12, marginTop: 8 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
