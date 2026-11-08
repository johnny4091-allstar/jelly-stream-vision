import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { LIVE_CHANNELS, resolveLive, type LiveChannel } from '../live';
import { PODCASTS, fetchPodcastEpisodes, formatDuration, type Episode } from '../media';
import { openArticle, openAuth, openBriefing, openCoverage, openLiveTv, openQuickRead, openScores, openTopic, openWeather } from '../navigation';
import { formatChange, formatPrice } from '../services/markets';
import { useStoryImage } from '../services/previewImage';
import { condition, conditionIcon, formatTemp } from '../services/weather';
import { getSource } from '../sources';
import { useAccount } from '../state/AccountContext';
import { useAudio } from '../state/AudioContext';
import { useSettings } from '../state/SettingsContext';
import { useWeather } from '../state/WeatherContext';
import { fonts, type, useTheme } from '../theme';
import type { Story } from '../types';
import { useCoverage } from '../screens/CoverageScreen';
import { streak } from '../services/activity';
import { useQuotes } from './MarketsStrip';
import { RadarPreview } from './RadarPreview';
import { StatusText, useGames } from './Scores';
import { WeatherBoundary } from './WeatherBoundary';
import { icon, skyColors } from './WeatherCard';


function Tile({
  children,
  onPress,
  label,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tile, { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.85 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
}

function Label({ children, color }: { children: ReactNode; color?: string }) {
  const c = useTheme();
  return <Text style={[styles.label, { color: color ?? c.tertiary }]}>{children}</Text>;
}

/** Weather with a radar still; asks for location the first time. */
function WeatherTile() {
  const c = useTheme();
  const { tempUnit } = useSettings();
  const { access, weather, loading, failed, enable, refresh } = useWeather();

  if (!weather) {
    const asking = access !== 'granted';
    return (
      <Tile style={styles.fill}>
        <Label>Weather</Label>
        <Ionicons name="partly-sunny" size={40} color="#5CC8FF" style={{ marginTop: 10 }} />
        <Text style={[styles.tileBody, { color: c.secondary }]}>
          {access === 'blocked'
            ? 'Location is off for News Hammer.'
            : asking
              ? 'See the weather where you are.'
              : loading || !failed
                ? 'Getting your local weather…'
                : "Couldn't load the weather."}
        </Text>
        {asking || failed ? (
          <Pressable onPress={asking ? enable : refresh} style={[styles.smallBtn, { backgroundColor: c.accent }]} accessibilityRole="button">
            <Text style={[styles.smallBtnText, { color: c.onAccent }]}>
              {access === 'blocked' ? 'Open settings' : asking ? 'Show weather' : 'Try again'}
            </Text>
          </Pressable>
        ) : (
          <ActivityIndicator style={{ marginTop: 10, alignSelf: 'flex-start' }} color={c.tertiary} />
        )}
      </Tile>
    );
  }

  const now = weather.current;
  const today = weather.daily[0];
  const rain = weather.hourly.slice(1, 13).find((h) => h.rainChance >= 50);
  const rainHour = rain ? new Date(rain.time).getHours() : 0;
  return (
    <Pressable
      onPress={openWeather}
      accessibilityRole="button"
      accessibilityLabel={`Weather${weather.place ? ` in ${weather.place}` : ''}: ${formatTemp(now.temp, tempUnit)}, ${condition(now.code).label}`}
      style={styles.fill}
    >
      <LinearGradient colors={skyColors(now.code, now.isDay)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.tile, styles.fill]}>
        <Label color="rgba(255,255,255,0.85)">{weather.place ?? 'Weather'}</Label>
        <View style={styles.wxRow}>
          <Text style={styles.wxTemp}>{formatTemp(now.temp, tempUnit)}</Text>
          <Ionicons name={icon(conditionIcon(now.code, now.isDay))} size={30} color="#fff" />
        </View>
        <Text style={styles.wxText} numberOfLines={2}>
          {condition(now.code).label}
          {today ? ` · H ${formatTemp(today.high, tempUnit)} L ${formatTemp(today.low, tempUnit)}` : ''}
        </Text>
        {weather.coords ? (
          <View style={{ marginTop: 10 }}>
            <RadarPreview coords={weather.coords} height={92} dark={c.dark} compact />
          </View>
        ) : null}
        <Text style={[styles.wxText, { marginTop: 8, fontSize: 12 }]} numberOfLines={1}>
          {rain ? `Rain around ${rainHour % 12 || 12}${rainHour < 12 ? 'am' : 'pm'} · ${rain.rainChance}%` : 'No rain expected soon'}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

function MarketsTile() {
  const c = useTheme();
  const { quotes, failed } = useQuotes();
  const indexes = quotes.filter((q) => q.kind === 'index').slice(0, 3);
  const open = indexes.some((q) => q.open);
  const lead = indexes[0];
  return (
    <Tile onPress={() => openTopic('business')} label="Markets" style={styles.fill}>
      <Label>{lead ? `${lead.name.replace('Dow Jones', 'Dow')} · ${open ? 'Open' : 'Closed'}` : 'Markets'}</Label>
      {!lead ? (
        failed ? (
          <Text style={[styles.tileBody, { color: c.secondary }]}>Prices unavailable</Text>
        ) : (
          <ActivityIndicator style={{ marginTop: 10, alignSelf: 'flex-start' }} color={c.tertiary} />
        )
      ) : (
        <>
          <Text style={[styles.bigNumber, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatPrice(lead)}
          </Text>
          <Text style={[styles.mkChange, { color: lead.change > 0 ? c.up : lead.change < 0 ? c.down : c.tertiary }]}>
            {lead.change > 0 ? '▲ ' : lead.change < 0 ? '▼ ' : ''}
            {formatChange(lead)}
          </Text>
          {indexes.slice(1).map((q) => (
            <View key={q.symbol} style={styles.mkRow}>
              <Text style={[styles.mkName, { color: c.secondary }]} numberOfLines={1}>
                {q.name.replace('Dow Jones', 'Dow')}
              </Text>
              <Text style={[styles.mkSmall, { color: q.change > 0 ? c.up : q.change < 0 ? c.down : c.tertiary }]}>{formatChange(q)}</Text>
            </View>
          ))}
        </>
      )}
    </Tile>
  );
}

function ScoresTile() {
  const c = useTheme();
  const { games } = useGames();
  const top = (games ?? []).slice(0, 1)[0];
  return (
    <Tile onPress={openScores} label="Scores" style={styles.fill}>
      <Label>{top ? top.leagueName : 'Scores'}</Label>
      {games === null ? (
        <ActivityIndicator style={{ marginTop: 10, alignSelf: 'flex-start' }} color={c.tertiary} />
      ) : !top ? (
        <Text style={[styles.tileBody, { color: c.secondary }]}>No games today</Text>
      ) : (
        <>
          {[top.away, top.home].map((t) => (
            <View key={t.abbr} style={styles.scRow}>
              {t.logo ? <Image source={{ uri: t.logo }} style={styles.scLogo} contentFit="contain" /> : null}
              <Text style={[styles.scTeam, { color: c.text }]} numberOfLines={1}>
                {t.abbr}
              </Text>
              <Text style={[styles.scScore, { color: c.text }]}>{top.state === 'pre' ? '' : t.score}</Text>
            </View>
          ))}
          <StatusText game={top} small />
        </>
      )}
    </Tile>
  );
}

function QuickReadTile() {
  const c = useTheme();
  return (
    <Pressable
      onPress={openQuickRead}
      accessibilityRole="button"
      accessibilityLabel="Quick read: today's top stories"
      style={({ pressed }) => [styles.tile, styles.fill, styles.quick, { backgroundColor: c.accent, borderColor: c.accent, opacity: pressed ? 0.9 : 1 }]}
    >
      <Text style={[type.eyebrow, { color: c.onAccent }]}>Quick read</Text>
      <Ionicons name="flash" size={30} color={c.onAccent} />
      <Text style={[styles.quickTitle, { color: c.onAccent }]}>Top 8{'\n'}in 3 min</Text>
    </Pressable>
  );
}

/** The first Live TV channel that's on air, with its current picture. */
function LiveTile() {
  const [live, setLive] = useState<{ channel: LiveChannel; videoId?: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const channel of LIVE_CHANNELS.slice(0, 4)) {
        const r = await resolveLive(channel).catch(() => null);
        if (cancelled) return;
        if (r?.status === 'live') return setLive({ channel, videoId: r.videoId });
      }
      if (!cancelled) setLive({ channel: LIVE_CHANNELS[0]! });
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const channel = live?.channel ?? LIVE_CHANNELS[0]!;
  const c = useTheme();
  return (
    <Pressable onPress={openLiveTv} accessibilityRole="button" accessibilityLabel={`Live TV: ${channel.name}`} style={[styles.tile, styles.live, { backgroundColor: channel.color }]}>
      {live?.videoId ? (
        <Image source={{ uri: `https://i.ytimg.com/vi/${live.videoId}/hqdefault_live.jpg` }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
      ) : (
        <Text style={styles.liveWordmark}>{channel.short}</Text>
      )}
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)']} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.liveText}>
        <View style={[styles.liveBadge, { backgroundColor: c.accent }]}>
          <View style={[styles.liveDot, { backgroundColor: c.onAccent }]} />
          <Text style={[styles.liveBadgeText, { color: c.onAccent }]}>LIVE</Text>
        </View>
        <Text style={styles.liveName} numberOfLines={1}>
          {channel.name}
        </Text>
        <Ionicons name="play-circle" size={26} color="#fff" style={{ marginLeft: 'auto' }} />
      </View>
    </Pressable>
  );
}

/** The podcast that's playing, or today's first show. */
function ListenTile() {
  const c = useTheme();
  const { episode, status, play, toggle } = useAudio();
  const [latest, setLatest] = useState<Episode | null>(null);
  useEffect(() => {
    if (episode) return;
    let cancelled = false;
    fetchPodcastEpisodes(PODCASTS[0]!)
      .then((e) => !cancelled && setLatest(e[0] ?? null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [episode]);
  const ep = episode ?? latest;
  if (!ep) return null;
  const playing = !!episode && status.playing;
  const left = episode && status.duration ? Math.max(0, status.duration - status.currentTime) : ep.duration;
  return (
    <Tile onPress={() => (episode ? toggle() : play(ep))} label={`${playing ? 'Pause' : 'Play'} ${ep.show}`} style={styles.listen}>
      <Image source={{ uri: ep.imageUrl }} style={styles.listenArt} contentFit="cover" />
      <View style={{ flex: 1, gap: 2 }}>
        <Label>{episode ? 'Continue listening' : "Today's podcast"}</Label>
        <Text style={[styles.listenTitle, { color: c.text }]} numberOfLines={1}>
          {ep.show}
          {left ? ` · ${formatDuration(left)}${episode ? ' left' : ''}` : ''}
        </Text>
      </View>
      <View style={[styles.playBtn, { backgroundColor: c.accent }]}>
        <Ionicons name={playing ? 'pause' : 'play'} size={18} color={c.onAccent} />
      </View>
    </Tile>
  );
}

function TopStoryTile({ story }: { story: Story }) {
  const c = useTheme();
  const image = useStoryImage(story);
  const coverage = useCoverage(story);
  const others = coverage.stories.filter((s) => s.sourceId !== story.sourceId).map((s) => s.sourceName);
  return (
    <Tile onPress={() => openArticle(story)} label={`Top story: ${story.title}`} style={styles.topStory}>
      <View style={[styles.topImage, { backgroundColor: getSource(story.sourceId)?.color ?? c.skeleton }]}>
        {image ? <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} /> : null}
        <View style={[styles.topTag, { backgroundColor: c.background }]}>
          <Text style={[type.eyebrow, { color: c.text }]}>Top story</Text>
        </View>
      </View>
      <View style={styles.topText}>
        <Text style={[styles.topTitle, { color: c.text }]} numberOfLines={4}>
          {story.title}
        </Text>
        <View style={styles.topMeta}>
          <Text style={[type.caption, { color: c.secondary, flex: 1, fontWeight: '600' }]} numberOfLines={1}>
            {[story.sourceName, ...others.slice(0, 2)].join(' · ')}
            {others.length > 2 ? ` +${others.length - 2}` : ''}
          </Text>
          {coverage.outlets > 1 ? (
            <Pressable
              onPress={() => openCoverage(story)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Full coverage: ${coverage.outlets} outlets`}
              style={[styles.coveragePill, { backgroundColor: c.elevated, borderColor: c.border }]}
            >
              <Ionicons name="layers-outline" size={14} color={c.accentText} />
              <Text style={[styles.coverageText, { color: c.accentText }]}>{coverage.outlets} outlets</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Tile>
  );
}

/** Today's briefing: one tap to listen to weather, top stories, your teams and markets. */
function BriefingTile() {
  const c = useTheme();
  const { activity } = useSettings();
  const days = streak(activity.days);
  return (
    <Tile onPress={openBriefing} label="Your briefing" style={styles.briefing}>
      <View style={[styles.briefPlay, { backgroundColor: c.accent }]}>
        <Ionicons name="play" size={22} color={c.onAccent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.eyebrow, { color: c.accentText }]}>Your briefing</Text>
        <Text style={[styles.briefTitle, { color: c.text }]}>Listen · about 5 min</Text>
      </View>
      {days > 1 ? (
        <View style={[styles.streakPill, { backgroundColor: c.elevated, borderColor: c.border }]}>
          <Ionicons name="flame" size={14} color={c.accent} />
          <Text style={[styles.streakText, { color: c.text }]}>{days}</Text>
        </View>
      ) : null}
    </Tile>
  );
}

const ACCOUNT_CARD_KEY = 'card:account:v1';

/** A one-time nudge to create an account, for people who skipped it (or updated from before). */
function AccountCard() {
  const c = useTheme();
  const account = useAccount();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(ACCOUNT_CARD_KEY)
      .then((v) => setDismissed(!!v))
      .catch(() => setDismissed(true));
  }, []);
  if (!account.enabled || account.status !== 'signedOut' || dismissed !== false) return null;
  const dismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem(ACCOUNT_CARD_KEY, '1').catch(() => {});
  };
  return (
    <View style={[styles.tile, styles.accountCard, { backgroundColor: c.card, borderColor: c.border }]}>
      <View style={[styles.accountIcon, { backgroundColor: c.accent }]}>
        <Ionicons name="person" size={20} color={c.onAccent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.listenTitle, { color: c.text }]}>Create a free account</Text>
        <Text style={{ color: c.secondary, fontSize: 13, lineHeight: 18 }}>Keep your saved stories, topics and teams on every phone.</Text>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
          <Pressable onPress={() => openAuth('signup')} accessibilityRole="button" hitSlop={6}>
            <Text style={{ color: c.accentText, fontWeight: '800', fontSize: 14 }}>Sign up</Text>
          </Pressable>
          <Pressable onPress={() => openAuth('signin')} accessibilityRole="button" hitSlop={6}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>Sign in</Text>
          </Pressable>
        </View>
      </View>
      <Pressable onPress={dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Not now">
        <Ionicons name="close" size={20} color={c.tertiary} />
      </Pressable>
    </View>
  );
}

/** "Today": everything checked daily at a glance, as a grid of live tiles above the news. */
export function Dashboard({ topStory }: { topStory?: Story }) {
  const { showWeather, showMarkets, showMedia } = useSettings();
  return (
    <View style={styles.wrap}>
      {showWeather || showMarkets ? (
        <View style={styles.row}>
          {showWeather ? (
            <View style={styles.col}>
              <WeatherBoundary>
                <WeatherTile />
              </WeatherBoundary>
            </View>
          ) : null}
          {showMarkets ? (
            <View style={styles.col}>
              <MarketsTile />
            </View>
          ) : null}
        </View>
      ) : null}
      {topStory ? <TopStoryTile story={topStory} /> : null}
      <BriefingTile />
      <View style={styles.row}>
        <View style={styles.col}>
          <ScoresTile />
        </View>
        <View style={styles.col}>
          <QuickReadTile />
        </View>
      </View>
      <AccountCard />
      <LiveTile />
      {showMedia ? <ListenTile /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 14, gap: 10, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  fill: { flex: 1 },
  tile: { borderRadius: 24, padding: 14, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  tileBody: { fontSize: 14, marginTop: 8, lineHeight: 19 },
  smallBtn: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginTop: 10 },
  smallBtnText: { fontSize: 14, fontWeight: '800' },
  wxRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  wxTemp: { color: '#fff', fontFamily: fonts.display, fontSize: 60, lineHeight: 64 },
  wxText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  bigNumber: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, marginTop: 10 },
  mkRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  mkName: { fontSize: 13, fontWeight: '700', flex: 1 },
  mkChange: { fontSize: 15, fontWeight: '800' },
  mkSmall: { fontSize: 13, fontWeight: '800' },
  scRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  scLogo: { width: 22, height: 22 },
  scTeam: { flex: 1, fontFamily: fonts.heading, fontSize: 24, lineHeight: 26 },
  scScore: { fontFamily: fonts.display, fontSize: 26, lineHeight: 28 },
  quick: { justifyContent: 'space-between', gap: 8, minHeight: 140 },
  quickTitle: { fontFamily: fonts.display, fontSize: 28, lineHeight: 28, textTransform: 'uppercase' },
  live: { height: 170, padding: 0, justifyContent: 'center', alignItems: 'center' },
  liveWordmark: { color: '#fff', fontSize: 28, fontWeight: '900' },
  liveText: { position: 'absolute', left: 14, right: 14, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveBadgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  liveName: { color: '#fff', fontFamily: fonts.heading, fontSize: 22, lineHeight: 24, flexShrink: 1 },
  listen: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listenArt: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#333' },
  listenTitle: { fontSize: 15, fontWeight: '800' },
  playBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  topStory: { padding: 0 },
  topImage: { height: 190, width: '100%' },
  topTag: { position: 'absolute', left: 12, top: 12, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  topText: { padding: 16, gap: 10 },
  topTitle: { fontFamily: fonts.heading, fontSize: 30, lineHeight: 31 },
  topMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  coveragePill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 5 },
  coverageText: { fontSize: 12, fontWeight: '800' },
  briefing: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  briefPlay: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  briefTitle: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 26, textTransform: 'uppercase' },
  streakPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 6 },
  streakText: { fontSize: 14, fontWeight: '900' },
  accountCard: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  accountIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
