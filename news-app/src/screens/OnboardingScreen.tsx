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
import { useTheme } from '../theme';

export const ONBOARDING_KEY = 'onboarding:v1';
const STEPS = 5;
type IconName = keyof typeof Ionicons.glyphMap;

function Welcome({ onNext }: { onNext: () => void }) {
  const insets = useSafeAreaInsets();
  const account = useAccount();
  return (
    <LinearGradient colors={['#1A0608', '#3A0B10', '#0B0B12']} style={[styles.flex, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar style="light" />
      <View style={styles.welcomeTop}>
        <Image source={require('../../assets/icon.png')} style={styles.welcomeLogo} />
        <Text style={styles.welcomeTitle}>
          News <Text style={{ color: '#FF3B40' }}>Hammer</Text>
        </Text>
        <Text style={styles.welcomeSub}>Top stories from 50 trusted sources, live TV, local weather, markets and scores. All in one place.</Text>
        <View style={styles.welcomePerks}>
          {(
            [
              ['newspaper', 'News from CNN, BBC, AP, Fox, NYT and more'],
              ['tv', 'Free live news channels'],
              ['partly-sunny', 'Your weather and radar'],
              ['trophy', 'Live scores for your teams'],
            ] as [IconName, string][]
          ).map(([icon, text]) => (
            <View key={text} style={styles.welcomePerk}>
              <Ionicons name={icon} size={18} color="#FF6B6F" />
              <Text style={styles.welcomePerkText}>{text}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.welcomeButtons}>
        {account.enabled ? (
          <>
            <Pressable onPress={() => openAuth('signup', 'back')} style={[styles.bigBtn, { backgroundColor: '#E3141B' }]} accessibilityRole="button">
              <Text style={styles.bigBtnText}>Create free account</Text>
            </Pressable>
            <Pressable onPress={() => openAuth('signin', 'back')} style={[styles.bigBtn, { backgroundColor: 'rgba(255,255,255,0.14)' }]} accessibilityRole="button">
              <Text style={styles.bigBtnText}>Sign in</Text>
            </Pressable>
            <Pressable onPress={onNext} style={styles.ghostBtn} accessibilityRole="button">
              <Text style={styles.ghostText}>Continue without an account</Text>
            </Pressable>
          </>
        ) : (
          <Pressable onPress={onNext} style={[styles.bigBtn, { backgroundColor: '#E3141B' }]} accessibilityRole="button">
            <Text style={styles.bigBtnText}>Get started</Text>
          </Pressable>
        )}
      </View>
    </LinearGradient>
  );
}

function StepHeader({ icon, title, sub }: { icon: IconName; title: string; sub: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: 8, marginBottom: 16 }}>
      <View style={[styles.stepIcon, { backgroundColor: c.accent }]}>
        <Ionicons name={icon} size={26} color="#fff" />
      </View>
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
      <StepHeader icon="newspaper" title="What do you want to follow?" sub="Pick a few. They get their own section on the Following tab." />
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
              style={[styles.topic, { backgroundColor: on ? t.color : c.card, borderColor: on ? t.color : c.separator }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={t.title}
            >
              <Ionicons name={t.icon as IconName} size={22} color={on ? '#fff' : t.color} />
              <Text style={[styles.topicText, { color: on ? '#fff' : c.text }]} numberOfLines={1}>
                {t.id === 'top' ? 'Top stories' : t.label}
              </Text>
              {on ? <Ionicons name="checkmark-circle" size={18} color="#fff" style={styles.topicCheck} /> : null}
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
      <StepHeader icon="trophy" title="Pick your teams" sub="Their games show first on your scores, live and final." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
        {TEAM_LEAGUES.map((l) => {
          const active = l.id === league;
          return (
            <Pressable
              key={l.id}
              onPress={() => setLeague(l.id)}
              style={[styles.chip, { backgroundColor: active ? c.chipActive : c.chip }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={{ color: active ? c.chipActiveText : c.chipText, fontWeight: '700' }}>{l.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={[styles.search, { backgroundColor: c.card }]}>
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
      {list === null || list === undefined ? <ActivityIndicator style={{ marginTop: 24 }} color={c.tertiary} /> : null}
      {list && list.length === 0 ? <Text style={{ color: c.secondary, marginTop: 16 }}>Couldn’t load teams. You can star teams later on the Scores screen.</Text> : null}
      {shown.map((t) => {
        const on = favoriteTeams.includes(t.abbr);
        return (
          <Pressable
            key={`${t.league}:${t.abbr}`}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              toggleFavoriteTeam(t.abbr);
            }}
            style={[styles.teamRow, { borderBottomColor: c.separator }]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={t.name}
          >
            {t.logo ? <Image source={{ uri: t.logo }} style={styles.teamLogo} contentFit="contain" /> : <View style={styles.teamLogo} />}
            <Text style={[styles.teamName, { color: c.text }]}>{t.name}</Text>
            <Ionicons name={on ? 'star' : 'star-outline'} size={22} color={on ? '#F5A623' : c.tertiary} />
          </Pressable>
        );
      })}
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
      <StepHeader icon="partly-sunny" title="Local weather" sub="See the weather, rain radar and forecast where you are. Your location stays on your phone; only a rough area is used for the forecast." />
      <Pressable
        onPress={enable}
        disabled={allowed}
        style={[styles.bigBtn, { backgroundColor: allowed ? c.card : c.accent }]}
        accessibilityRole="button"
      >
        <Text style={[styles.bigBtnText, { color: allowed ? c.text : '#fff' }]}>
          {allowed ? `✓ Location on${weather?.place ? ` · ${weather.place}` : ''}` : access === 'blocked' ? 'Open settings to allow location' : 'Allow location'}
        </Text>
      </Pressable>
      <Text style={[styles.smallLabel, { color: c.secondary }]}>Temperature</Text>
      <View style={[styles.segment, { backgroundColor: c.chip }]}>
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
      <StepHeader icon="notifications" title="Breaking news alerts" sub="Get a notification when big stories break, and when a new version of the app is ready. You can change this any time in Settings." />
      <Pressable onPress={onAsk} disabled={granted === true} style={[styles.bigBtn, { backgroundColor: granted ? c.card : c.accent }]} accessibilityRole="button">
        <Text style={[styles.bigBtnText, { color: granted ? c.text : '#fff' }]}>
          {granted ? '✓ Notifications on' : granted === false ? 'Notifications are off. Try again' : 'Turn on notifications'}
        </Text>
      </Pressable>
    </>
  );
}

/** First-launch setup: welcome (with sign-up / sign-in), topics, teams, weather, notifications. */
export function OnboardingScreen({ navigation }: OnboardingScreenProps) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
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

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: insets.top }}>
      <View style={styles.topBar}>
        <Pressable onPress={() => setStep((s) => s - 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </Pressable>
        <View style={styles.dots}>
          {Array.from({ length: STEPS - 1 }, (_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i < step ? c.accent : c.separator, width: i === step - 1 ? 22 : 8 }]} />
          ))}
        </View>
        <Pressable onPress={next} hitSlop={10} accessibilityRole="button">
          <Text style={{ color: c.secondary, fontWeight: '700', fontSize: 15 }}>Skip</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {step === 1 ? <Topics /> : step === 2 ? <Teams /> : step === 3 ? <Weather /> : <Notifications granted={notifications} onAsk={askNotifications} />}
      </ScrollView>
      <View style={{ padding: 16, paddingBottom: insets.bottom + 16 }}>
        <Pressable onPress={next} style={[styles.bigBtn, { backgroundColor: c.chipActive }]} accessibilityRole="button">
          <Text style={[styles.bigBtnText, { color: c.chipActiveText }]}>{step >= STEPS - 1 ? 'Start reading' : 'Continue'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  welcomeTop: { flex: 1, paddingHorizontal: 28, gap: 14 },
  welcomeLogo: { width: 84, height: 84, borderRadius: 22 },
  welcomeTitle: { color: '#fff', fontSize: 40, fontWeight: '900', letterSpacing: -1, marginTop: 8 },
  welcomeSub: { color: 'rgba(255,255,255,0.82)', fontSize: 17, lineHeight: 24 },
  welcomePerks: { gap: 12, marginTop: 14 },
  welcomePerk: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  welcomePerkText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  welcomeButtons: { paddingHorizontal: 20, gap: 10 },
  bigBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  bigBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  ghostBtn: { paddingVertical: 12, alignItems: 'center' },
  ghostText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '700' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { height: 8, borderRadius: 4 },
  stepIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.4 },
  stepSub: { fontSize: 16, lineHeight: 22 },
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  topic: { width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 16 },
  topicText: { fontSize: 16, fontWeight: '700', flex: 1 },
  topicCheck: { position: 'absolute', right: 10, top: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 12, marginBottom: 6 },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 16 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  teamLogo: { width: 30, height: 30 },
  teamName: { flex: 1, fontSize: 16, fontWeight: '600' },
  smallLabel: { fontSize: 13, fontWeight: '700', marginTop: 22, marginBottom: 8 },
  segment: { flexDirection: 'row', padding: 4, borderRadius: 999 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 999 },
});
