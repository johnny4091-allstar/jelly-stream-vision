import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { LIVE_CHANNELS, resolveLive, type LiveChannel } from '../live';
import { PODCASTS, fetchPodcastEpisodes, formatDuration, type Episode } from '../media';
import { openArticle, openAuth, openLiveTv, openQuickRead, openScores, openTopic, openWeather } from '../navigation';
import { formatChange, formatPrice } from '../services/markets';
import { useStoryImage } from '../services/previewImage';
import { condition, conditionIcon, formatTemp } from '../services/weather';
import { getSource } from '../sources';
import { useAccount } from '../state/AccountContext';
import { useAudio } from '../state/AudioContext';
import { useSettings } from '../state/SettingsContext';
import { useWeather } from '../state/WeatherContext';
import { useTheme } from '../theme';
import type { Story } from '../types';
import { partOfDay } from '../utils';
import { useQuotes } from './MarketsStrip';
import { RadarPreview } from './RadarPreview';
import { StatusText, useGames } from './Scores';
import { WeatherBoundary } from './WeatherBoundary';
import { icon, skyColors } from './WeatherCard';

const UP = '#12A150';
const DOWN = '#E5383B';

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
      style={({ pressed }) => [styles.tile, { backgroundColor: c.card, opacity: pressed ? 0.85 : 1 }, style]}
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
        <Ionicons name="partly-sunny" size={40} color="#2D74D6" style={{ marginTop: 10 }} />
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
          <Pressable onPress={asking ? enable : refresh} style={[styles.smallBtn, { backgroundColor: c.chipActive }]} accessibilityRole="button">
            <Text style={[styles.smallBtnText, { color: c.chipActiveText }]}>
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
        <Label color="rgba(255,255,255,0.85)">Weather</Label>
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
  return (
    <Tile onPress={() => openTopic('business')} label="Markets" style={styles.fill}>
      <Label>Markets{indexes.length ? ` · ${open ? 'Open' : 'Closed'}` : ''}</Label>
      {indexes.length === 0 ? (
        failed ? (
          <Text style={[styles.tileBody, { color: c.secondary }]}>Prices unavailable</Text>
        ) : (
          <ActivityIndicator style={{ marginTop: 10, alignSelf: 'flex-start' }} color={c.tertiary} />
        )
      ) : (
        indexes.map((q) => (
          <View key={q.symbol} style={styles.mkRow}>
            <Text style={[styles.mkName, { color: c.text }]} numberOfLines={1}>
              {q.name.replace('Dow Jones', 'Dow')}
            </Text>
            <Text style={[styles.mkChange, { color: q.change > 0 ? UP : q.change < 0 ? DOWN : c.tertiary }]}>{formatChange(q)}</Text>
          </View>
        ))
      )}
      {indexes[0] ? <Text style={[styles.tiny, { color: c.tertiary }]}>S&amp;P {formatPrice(indexes[0])}</Text> : null}
    </Tile>
  );
}

function ScoresTile() {
  const c = useTheme();
  const { games } = useGames();
  const top = (games ?? []).slice(0, 1)[0];
  return (
    <Tile onPress={openScores} label="Scores" style={styles.fill}>
      <Label>Scores</Label>
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
  return (
    <Pressable onPress={openQuickRead} accessibilityRole="button" accessibilityLabel="Quick read: today's top stories" style={[styles.tile, styles.quick]}>
      <View style={styles.bolt}>
        <Ionicons name="flash" size={22} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.quickTitle}>Quick read</Text>
        <Text style={styles.quickSub}>Today's top 8 stories, one swipe at a time</Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color="#fff" />
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
  return (
    <Pressable onPress={openLiveTv} accessibilityRole="button" accessibilityLabel={`Live TV: ${channel.name}`} style={[styles.tile, styles.live, { backgroundColor: channel.color }]}>
      {live?.videoId ? (
        <Image source={{ uri: `https://i.ytimg.com/vi/${live.videoId}/hqdefault_live.jpg` }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
      ) : (
        <Text style={styles.liveWordmark}>{channel.short}</Text>
      )}
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)']} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.liveText}>
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>LIVE</Text>
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
        <Ionicons name={playing ? 'pause' : 'play'} size={18} color="#fff" />
      </View>
    </Tile>
  );
}

function TopStoryTile({ story }: { story: Story }) {
  const c = useTheme();
  const image = useStoryImage(story);
  return (
    <Tile onPress={() => openArticle(story)} label={`Top story: ${story.title}`} style={styles.topStory}>
      {image ? (
        <Image source={{ uri: image }} style={styles.topImage} contentFit="cover" transition={250} />
      ) : (
        <View style={[styles.topImage, { backgroundColor: getSource(story.sourceId)?.color ?? c.skeleton }]} />
      )}
      <View style={styles.topText}>
        <Text style={[styles.label, { color: c.accent }]} numberOfLines={1}>
          TOP STORY · {story.sourceName.toUpperCase()}
        </Text>
        <Text style={[styles.topTitle, { color: c.text }]} numberOfLines={4}>
          {story.title}
        </Text>
      </View>
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
    <View style={[styles.tile, styles.accountCard, { backgroundColor: c.card }]}>
      <View style={[styles.accountIcon, { backgroundColor: c.accent }]}>
        <Ionicons name="person" size={20} color="#fff" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.listenTitle, { color: c.text }]}>Create a free account</Text>
        <Text style={{ color: c.secondary, fontSize: 13, lineHeight: 18 }}>Keep your saved stories, topics and teams on every phone.</Text>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
          <Pressable onPress={() => openAuth('signup')} accessibilityRole="button" hitSlop={6}>
            <Text style={{ color: c.accent, fontWeight: '800', fontSize: 14 }}>Sign up</Text>
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

const GREETING = { Morning: 'Good morning', Afternoon: 'Good afternoon', Evening: 'Good evening' } as const;

/** "Today": everything checked daily at a glance, above the news. */
export function Dashboard({ topStory }: { topStory?: Story }) {
  const c = useTheme();
  const { showWeather, showMarkets, showMedia } = useSettings();
  const { weather } = useWeather();
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const side = (
    <>
      {showMarkets ? <MarketsTile /> : null}
      <ScoresTile />
    </>
  );
  return (
    <View style={styles.wrap}>
      <View style={styles.greet}>
        <Text style={[styles.hello, { color: c.text }]}>{GREETING[partOfDay()]}</Text>
        <Text style={[styles.date, { color: c.tertiary }]}>
          {date}
          {showWeather && weather?.place ? ` · ${weather.place}` : ''}
        </Text>
      </View>
      {showWeather ? (
        <View style={styles.row}>
          <View style={styles.col}>
            <WeatherBoundary>
              <WeatherTile />
            </WeatherBoundary>
          </View>
          <View style={[styles.col, { gap: 10 }]}>{side}</View>
        </View>
      ) : (
        <View style={[styles.row, styles.pair]}>{side}</View>
      )}
      <AccountCard />
      <QuickReadTile />
      <LiveTile />
      {showMedia ? <ListenTile /> : null}
      {topStory ? <TopStoryTile story={topStory} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, gap: 10, marginBottom: 6 },
  greet: { paddingHorizontal: 6, paddingBottom: 4 },
  hello: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  date: { fontSize: 14, marginTop: 2 },
  row: { flexDirection: 'row', gap: 10 },
  pair: { alignItems: 'stretch' },
  col: { flex: 1 },
  fill: { flex: 1 },
  tile: { borderRadius: 22, padding: 14, overflow: 'hidden' },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },
  tileBody: { fontSize: 14, marginTop: 8, lineHeight: 19 },
  tiny: { fontSize: 11, marginTop: 6 },
  smallBtn: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginTop: 10 },
  smallBtnText: { fontSize: 14, fontWeight: '700' },
  wxRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  wxTemp: { color: '#fff', fontSize: 48, fontWeight: '300', letterSpacing: -1 },
  wxText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  mkRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  mkName: { fontSize: 14, fontWeight: '700', flex: 1 },
  mkChange: { fontSize: 14, fontWeight: '800' },
  scRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  scLogo: { width: 20, height: 20 },
  scTeam: { flex: 1, fontSize: 16, fontWeight: '800' },
  scScore: { fontSize: 16, fontWeight: '800' },
  quick: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#111114' },
  bolt: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E3141B', alignItems: 'center', justifyContent: 'center' },
  quickTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  quickSub: { color: 'rgba(255,255,255,0.72)', fontSize: 13, marginTop: 1 },
  live: { height: 160, padding: 0, justifyContent: 'center', alignItems: 'center' },
  liveWordmark: { color: '#fff', fontSize: 28, fontWeight: '900' },
  liveText: { position: 'absolute', left: 14, right: 14, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveBadge: { backgroundColor: '#E8352E', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  liveBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  liveName: { color: '#fff', fontSize: 16, fontWeight: '800', flexShrink: 1 },
  listen: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listenArt: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#333' },
  listenTitle: { fontSize: 15, fontWeight: '800' },
  playBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  topStory: { flexDirection: 'row', padding: 0, height: 128 },
  accountCard: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  accountIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  topImage: { width: '40%', height: '100%' },
  topText: { flex: 1, padding: 12, gap: 4 },
  topTitle: { fontSize: 16, lineHeight: 20, fontWeight: '700' },
});
