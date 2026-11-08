import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GoogleButton } from '../components/AccountPrompts';
import { StackHeader } from '../components/common';
import { useQuotes } from '../components/MarketsStrip';
import { StatusText, useGames } from '../components/Scores';
import { openArticle, openAuth, openScores } from '../navigation';
import { formatChange } from '../services/markets';
import { pickTopStories } from '../services/news';
import { condition, formatTemp } from '../services/weather';
import { getSource } from '../sources';
import { useAccount } from '../state/AccountContext';
import { useSettings } from '../state/SettingsContext';
import { useStories } from '../state/useStories';
import { useWeather } from '../state/WeatherContext';
import { fonts, type, useTheme } from '../theme';
import type { Story } from '../types';
import { partOfDay, timeAgo } from '../utils';

const STORIES = 5;

/** The day's top stories with the most variety of outlets. */
export function useBriefingStories(): { stories: Story[]; loading: boolean } {
  const { stories, loading } = useStories('top');
  return { stories: useMemo(() => pickTopStories(stories, STORIES), [stories]), loading };
}

/**
 * The morning briefing: weather, five top stories, your teams and the markets, read aloud in about
 * five minutes. Signed-out people (when accounts are on) see the first story, then an offer to get
 * it every morning; one tap reads today's anyway.
 */
export function BriefingScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const { tempUnit, favoriteTeams, briefingAlert, setBriefingAlert, recordActivity } = useSettings();
  const { weather } = useWeather();
  const { quotes } = useQuotes();
  const { games } = useGames();
  const { stories, loading } = useBriefingStories();
  const [speaking, setSpeaking] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const gated = account.enabled && account.status === 'signedOut' && !revealed;
  const alertAvailable = !account.enabled || account.status === 'signedIn';

  const myGames = (games ?? []).filter((g) => favoriteTeams.includes(g.home.abbr) || favoriteTeams.includes(g.away.abbr)).slice(0, 3);
  const index = quotes.find((q) => q.kind === 'index');

  useEffect(() => recordActivity('briefing'), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => void Speech.stop().catch(() => {}), []);

  const script = useMemo(() => {
    const parts = [`Good ${partOfDay().toLowerCase()}. Here's your News Hammer briefing.`];
    if (weather) {
      const today = weather.daily[0];
      parts.push(
        `In ${weather.place || 'your area'}, it's ${formatTemp(weather.current.temp, tempUnit)} and ${condition(weather.current.code).label.toLowerCase()}` +
          (today ? `, with a high of ${formatTemp(today.high, tempUnit)}.` : '.'),
      );
    }
    stories.forEach((s, i) => parts.push(`${i === 0 ? 'First' : i === stories.length - 1 ? 'And finally' : 'Next'}, from ${s.sourceName}: ${s.title}.`));
    for (const g of myGames)
      parts.push(
        g.state === 'pre'
          ? `${g.away.name} at ${g.home.name}, ${g.detail}.`
          : `${g.away.name} ${g.away.score}, ${g.home.name} ${g.home.score}, ${g.state === 'post' ? 'final' : g.detail}.`,
      );
    if (index) parts.push(`The ${index.name} is ${index.change >= 0 ? 'up' : 'down'} ${Math.abs(index.changePercent).toFixed(1)} percent.`);
    parts.push("That's your briefing. Have a good one.");
    return parts.join(' ');
  }, [weather, tempUnit, stories, myGames, index]);

  const listen = () => {
    Speech.stop().catch(() => {});
    if (speaking) return setSpeaking(false);
    setSpeaking(true);
    setRevealed(true);
    Speech.speak(script, { onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false), onError: () => setSpeaking(false) });
  };
  const minutes = Math.max(1, Math.round(script.split(' ').length / 150));
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  const storyCard = (s: Story, i: number) => (
    <Pressable
      key={s.id}
      onPress={() => openArticle(s)}
      accessibilityRole="link"
      accessibilityLabel={`${s.sourceName}: ${s.title}`}
      style={[styles.card, styles.storyRow, { backgroundColor: c.card, borderColor: c.border }]}
    >
      <Text style={[styles.num, { color: c.accentText }]}>{i + 1}</Text>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.sourceRow}>
          <View style={[styles.dot, { backgroundColor: getSource(s.sourceId)?.color ?? c.tertiary }]} />
          <Text style={[type.eyebrow, { color: c.tertiary }]} numberOfLines={1}>
            {s.sourceName}
            {s.publishedAt ? ` · ${timeAgo(s.publishedAt)}` : ''}
          </Text>
        </View>
        <Text style={[type.rowTitle, { color: c.text }]}>{s.title}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StackHeader title="Your briefing" />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 32, gap: 10 }}>
        <Text style={[type.eyebrow, { color: c.tertiary, marginLeft: 4 }]}>{date}</Text>
        <Pressable
          onPress={listen}
          accessibilityRole="button"
          accessibilityLabel={speaking ? 'Stop the briefing' : 'Listen to the briefing'}
          style={[styles.card, styles.listen, { backgroundColor: c.accent, borderColor: c.accent }]}
        >
          <View style={[styles.play, { backgroundColor: c.onAccent }]}>
            <Ionicons name={speaking ? 'stop' : 'play'} size={24} color={c.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.listenTitle, { color: c.onAccent }]}>{speaking ? 'Playing…' : `Listen · ${minutes} min`}</Text>
            <Text style={{ color: c.onAccent, fontSize: 13, fontWeight: '700' }}>
              {stories.length} stories{weather ? ' · weather' : ''}
              {myGames.length ? ' · your teams' : ''}
              {index ? ' · markets' : ''}
            </Text>
          </View>
        </Pressable>

        {weather ? (
          <View style={[styles.card, styles.row, { backgroundColor: '#16233F', borderColor: '#22345A' }]}>
            <Text style={styles.temp}>{formatTemp(weather.current.temp, tempUnit)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{condition(weather.current.code).label}</Text>
              <Text style={{ color: '#CFE0FF', fontSize: 13 }}>
                {[weather.place, weather.daily[0] ? `H ${formatTemp(weather.daily[0].high, tempUnit)} L ${formatTemp(weather.daily[0].low, tempUnit)}` : '']
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          </View>
        ) : null}

        {loading && stories.length === 0 ? <ActivityIndicator style={{ marginVertical: 30 }} color={c.tertiary} /> : null}
        {stories[0] ? storyCard(stories[0], 0) : null}

        <View style={gated ? { minHeight: 400 } : undefined}>
          <View style={[{ gap: 10 }, gated && { opacity: 0.18 }]} pointerEvents={gated ? 'none' : 'auto'}>
            {stories.slice(1).map((s, i) => storyCard(s, i + 1))}
            {myGames.length ? (
              <>
                <Text style={[styles.section, { color: c.text }]}>Your teams</Text>
                {myGames.map((g) => (
                  <Pressable key={g.id} onPress={openScores} style={[styles.card, styles.row, { backgroundColor: c.card, borderColor: c.border }]} accessibilityRole="button">
                    <Text style={[styles.game, { color: c.text, flex: 1 }]}>
                      {g.away.abbr} {g.state === 'pre' ? '' : g.away.score} · {g.home.abbr} {g.state === 'pre' ? '' : g.home.score}
                    </Text>
                    <StatusText game={g} small />
                  </Pressable>
                ))}
              </>
            ) : null}
            {index ? (
              <View style={[styles.card, styles.row, { backgroundColor: c.card, borderColor: c.border }]}>
                <Ionicons name={index.change >= 0 ? 'trending-up' : 'trending-down'} size={24} color={index.change >= 0 ? c.up : c.down} />
                <Text style={{ color: c.text, fontSize: 15, fontWeight: '800', flex: 1 }}>{index.name}</Text>
                <Text style={{ color: index.change >= 0 ? c.up : c.down, fontSize: 15, fontWeight: '800' }}>{formatChange(index)}</Text>
              </View>
            ) : null}
          </View>

          {gated ? (
            <View style={styles.gate}>
              <View style={[styles.card, styles.gateCard, { backgroundColor: c.elevated, borderColor: c.border }]}>
                <Ionicons name="alarm-outline" size={34} color={c.accentText} />
                <Text style={[styles.gateTitle, { color: c.text }]}>Get this every morning</Text>
                <Text style={{ color: c.secondary, fontSize: 14, lineHeight: 20, textAlign: 'center' }}>
                  A free account sends your briefing at 7 AM, built from your topics and teams.
                </Text>
                <View style={{ alignSelf: 'stretch', gap: 8 }}>
                  <GoogleButton />
                  <Pressable onPress={() => openAuth('signup', 'back')} style={[styles.gateBtn, { backgroundColor: c.accent }]} accessibilityRole="button">
                    <Text style={{ color: c.onAccent, fontSize: 16, fontWeight: '800' }}>Sign up free</Text>
                  </Pressable>
                </View>
                <Pressable onPress={() => setRevealed(true)} hitSlop={8} accessibilityRole="button">
                  <Text style={{ color: c.tertiary, fontSize: 13, fontWeight: '700' }}>Read today’s for free ↓</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        {alertAvailable ? (
          <View style={[styles.card, styles.row, { backgroundColor: c.card, borderColor: c.border, marginTop: 6 }]}>
            <Ionicons name="alarm-outline" size={22} color={c.text} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 15, fontWeight: '800' }}>Every morning at 7 AM</Text>
              <Text style={{ color: c.tertiary, fontSize: 13 }}>A notification when your briefing is ready</Text>
            </View>
            <Switch value={briefingAlert} onValueChange={setBriefingAlert} trackColor={{ true: c.accent, false: c.border }} thumbColor="#F5F5F7" accessibilityLabel="Morning briefing notification" />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listen: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  play: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  listenTitle: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 28, textTransform: 'uppercase' },
  temp: { color: '#fff', fontFamily: fonts.display, fontSize: 44, lineHeight: 48 },
  storyRow: { flexDirection: 'row', gap: 12 },
  num: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32, width: 22 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  section: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 24, textTransform: 'uppercase', marginTop: 8, marginLeft: 4 },
  game: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 22 },
  gate: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingTop: 10 },
  gateCard: { width: '92%', alignItems: 'center', gap: 12, padding: 20 },
  gateTitle: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 28, textTransform: 'uppercase', textAlign: 'center' },
  gateBtn: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
