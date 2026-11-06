import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showBackgroundGuideOnce } from '../components/BackgroundGuide';
import { openAuth, type OnboardingScreenProps } from '../navigation';
import { setUpNotifications } from '../services/notifications';
import { TEAM_LEAGUES, fetchTeams, type TeamInfo } from '../services/scores';
import type { TempUnit } from '../services/weather';
import { TOPICS } from '../sources';
import { useAccount } from '../state/AccountContext';
import { useSettings } from '../state/SettingsContext';
import { useWeather } from '../state/WeatherContext';
import { HAMMER, fonts, type, useTheme } from '../theme';

export const ONBOARDING_KEY = 'onboarding:v1';
/** Welcome, four setup steps, then the summary. */
const STEPS = 6;
const SETUP_STEPS = 4;
type IconName = keyof typeof Ionicons.glyphMap;

function Welcome({ onNext }: { onNext: () => void }) {
  const insets = useSafeAreaInsets();
  const account = useAccount();
  return (
    <LinearGradient
      colors={['#3A1608', '#0B0B0D']}
      locations={[0, 0.62]}
      style={[styles.flex, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}
    >
      <StatusBar style="light" />
      <View style={styles.welcomeTop}>
        <Image source={require('../../assets/icon.png')} style={styles.welcomeLogo} />
        <View>
          <Text style={styles.welcomeTitle}>News</Text>
          <Text style={[styles.welcomeTitle, { color: HAMMER }]}>Hammer</Text>
        </View>
        <Text style={styles.welcomeSub}>50 trusted sources, live scores, markets and weather. All in one place, built around you.</Text>
        <View style={styles.welcomeTags}>
          {(
            [
              ['radio-button-on', 'Live news'],
              ['trophy', 'Scores'],
              ['partly-sunny', 'Weather'],
              ['headset', 'Listen'],
            ] as [IconName, string][]
          ).map(([icon, text]) => (
            <View key={text} style={styles.welcomeTag}>
              <Ionicons name={icon} size={13} color={HAMMER} />
              <Text style={styles.welcomeTagText}>{text}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.welcomeButtons}>
        {account.enabled ? (
          <>
            <Pressable onPress={() => openAuth('signup', 'back')} style={[styles.bigBtn, { backgroundColor: HAMMER }]} accessibilityRole="button">
              <Text style={[styles.bigBtnText, { color: '#120600' }]}>Create free account</Text>
            </Pressable>
            <Pressable onPress={() => openAuth('signin', 'back')} style={[styles.bigBtn, styles.darkBtn]} accessibilityRole="button">
              <Text style={styles.bigBtnText}>Sign in</Text>
            </Pressable>
            <Pressable onPress={onNext} style={styles.ghostBtn} accessibilityRole="button">
              <Text style={styles.ghostText}>Continue without an account</Text>
            </Pressable>
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
    ['Alerts', notifications ? 'Breaking news' : 'Off'],
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

  const askNotifications = async () => setNotifications(await setUpNotifications().catch(() => false));
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
  welcomeTop: { flex: 1, paddingHorizontal: 28, gap: 18, alignItems: 'center', justifyContent: 'center' },
  welcomeLogo: { width: 104, height: 104, borderRadius: 26 },
  welcomeTitle: { color: '#F5F5F7', fontFamily: fonts.display, fontSize: 66, lineHeight: 64, textTransform: 'uppercase', textAlign: 'center' },
  welcomeSub: { color: '#B4B4BC', fontSize: 17, lineHeight: 25, textAlign: 'center' },
  welcomeTags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  welcomeTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1E1E23', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  welcomeTagText: { color: '#F5F5F7', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  welcomeButtons: { paddingHorizontal: 20, gap: 10 },
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
