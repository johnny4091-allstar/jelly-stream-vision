import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StackHeader } from '../components/common';
import { useQuotes } from '../components/MarketsStrip';
import { useGames } from '../components/Scores';
import { openArticle, openCoverage, openScores, openWeather } from '../navigation';
import { readOn, streak } from '../services/activity';
import { biggestStories } from '../services/coverage';
import { formatChange } from '../services/markets';
import { cachedStories } from '../services/news';
import { condition, formatTemp } from '../services/weather';
import { getSource } from '../sources';
import { useSaved } from '../state/SavedContext';
import { useSettings } from '../state/SettingsContext';
import { useStories } from '../state/useStories';
import { useWeather } from '../state/WeatherContext';
import { fonts, type, useTheme } from '../theme';

/** "Your day in news": what you read, the day's biggest stories, your teams, markets, tomorrow. */
export function RecapScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { activity, favoriteTeams, tempUnit, recapAlert, setRecapAlert } = useSettings();
  const { saved } = useSaved();
  const { stories } = useStories('top');
  const { games } = useGames();
  const { quotes } = useQuotes();
  const { weather } = useWeather();
  const [speaking, setSpeaking] = useState(false);

  const midnight = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }, []);
  const biggest = useMemo(() => biggestStories(cachedStories(), midnight, 5), [stories, midnight]); // eslint-disable-line react-hooks/exhaustive-deps
  const myGames = (games ?? []).filter((g) => favoriteTeams.includes(g.home.abbr) || favoriteTeams.includes(g.away.abbr));
  const index = quotes.find((q) => q.kind === 'index');
  const tomorrow = weather?.daily[1];
  const readToday = readOn(activity);
  const days = streak(activity.days);

  useEffect(() => () => void Speech.stop().catch(() => {}), []);
  const listen = () => {
    Speech.stop().catch(() => {});
    if (speaking) return setSpeaking(false);
    const parts = [`Here's your day in news. You read ${readToday} ${readToday === 1 ? 'story' : 'stories'} today.`];
    biggest.forEach((b, i) => parts.push(`${i === 0 ? "Today's biggest story" : 'Also'}, covered by ${b.outlets} outlets: ${b.stories[0]!.title}.`));
    for (const g of myGames) if (g.state !== 'pre') parts.push(`${g.away.name} ${g.away.score}, ${g.home.name} ${g.home.score}, ${g.state === 'post' ? 'final' : g.detail}.`);
    if (index) parts.push(`The ${index.name} ${index.change >= 0 ? 'gained' : 'lost'} ${Math.abs(index.changePercent).toFixed(1)} percent.`);
    if (tomorrow && weather) parts.push(`Tomorrow: ${condition(tomorrow.code).label.toLowerCase()}, high of ${formatTemp(tomorrow.high, tempUnit)}.`);
    parts.push('Good night.');
    setSpeaking(true);
    Speech.speak(parts.join(' '), { onDone: () => setSpeaking(false), onStopped: () => setSpeaking(false), onError: () => setSpeaking(false) });
  };

  const stat = (value: number | string, label: string, accent?: boolean) => (
    <View style={[styles.card, styles.stat, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={[styles.statValue, { color: accent ? c.accentText : c.text }]}>{value}</Text>
      <Text style={{ color: c.tertiary, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StackHeader title="Your day in news" />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 32, gap: 10 }}>
        <View style={[styles.card, styles.hero, { borderColor: 'rgba(255,90,31,0.5)' }]}>
          <Text style={[type.eyebrow, { color: c.accentText }]}>
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          <Text style={styles.heroTitle}>
            You read <Text style={{ color: c.accent }}>{readToday}</Text> {readToday === 1 ? 'story' : 'stories'} today
          </Text>
          <Pressable onPress={listen} style={[styles.listen, { backgroundColor: c.accent }]} accessibilityRole="button" accessibilityLabel={speaking ? 'Stop the recap' : 'Listen to the recap'}>
            <Ionicons name={speaking ? 'stop' : 'play'} size={18} color={c.onAccent} />
            <Text style={{ color: c.onAccent, fontSize: 15, fontWeight: '800' }}>{speaking ? 'Stop' : 'Listen · 2 min'}</Text>
          </Pressable>
        </View>
        <View style={styles.stats}>
          {stat(days, days === 1 ? 'Day streak' : 'Day streak', true)}
          {stat(activity.read, 'All-time reads')}
          {stat(saved.length, 'Saved')}
        </View>

        <Text style={[styles.section, { color: c.text }]}>Biggest stories today</Text>
        {biggest.length === 0 ? <Text style={{ color: c.secondary, marginLeft: 4 }}>Not enough stories loaded yet today.</Text> : null}
        {biggest.map((b, i) => {
          const lead = b.stories[0]!;
          return (
            <Pressable
              key={lead.id}
              onPress={() => openArticle(lead)}
              accessibilityRole="link"
              accessibilityLabel={`${lead.title}, ${b.outlets} outlets`}
              style={[styles.card, styles.row, { backgroundColor: c.card, borderColor: c.border, alignItems: 'flex-start' }]}
            >
              <Text style={[styles.rank, { color: c.accentText }]}>{i + 1}</Text>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[type.rowTitle, { color: c.text }]}>{lead.title}</Text>
                <View style={styles.row}>
                  <View style={styles.bar}>
                    {b.stories.slice(0, 10).map((s) => (
                      <View key={s.sourceId} style={{ flex: 1, backgroundColor: getSource(s.sourceId)?.color ?? c.tertiary }} />
                    ))}
                  </View>
                  {b.outlets > 1 ? (
                    <Pressable onPress={() => openCoverage(lead)} hitSlop={8} accessibilityRole="button">
                      <Text style={{ color: c.accentText, fontSize: 12, fontWeight: '800' }}>{b.outlets} outlets ›</Text>
                    </Pressable>
                  ) : (
                    <Text style={{ color: c.tertiary, fontSize: 12, fontWeight: '700' }}>{lead.sourceName}</Text>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}

        {myGames.length ? (
          <>
            <Text style={[styles.section, { color: c.text }]}>Your teams</Text>
            {myGames.map((g) => (
              <Pressable key={g.id} onPress={openScores} style={[styles.card, styles.row, { backgroundColor: c.card, borderColor: c.border }]} accessibilityRole="button">
                <Text style={[styles.game, { color: c.text, flex: 1 }]}>
                  {g.away.abbr} {g.state === 'pre' ? '' : g.away.score} · {g.home.abbr} {g.state === 'pre' ? '' : g.home.score}
                </Text>
                <Text style={{ color: g.state === 'in' ? c.accentText : c.tertiary, fontWeight: '800', fontSize: 13 }}>{g.detail}</Text>
              </Pressable>
            ))}
          </>
        ) : null}

        {index ? (
          <View style={[styles.card, styles.row, { backgroundColor: c.card, borderColor: c.border }]}>
            <Ionicons name={index.change >= 0 ? 'trending-up' : 'trending-down'} size={24} color={index.change >= 0 ? c.up : c.down} />
            <Text style={{ color: c.text, fontSize: 15, fontWeight: '800', flex: 1 }}>{index.name} today</Text>
            <Text style={{ color: index.change >= 0 ? c.up : c.down, fontSize: 15, fontWeight: '800' }}>{formatChange(index)}</Text>
          </View>
        ) : null}

        {tomorrow && weather ? (
          <Pressable onPress={openWeather} accessibilityRole="button" style={[styles.card, styles.row, { backgroundColor: '#16233F', borderColor: '#22345A' }]}>
            <Ionicons name="moon" size={22} color="#CFE0FF" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Tomorrow: {condition(tomorrow.code).label}</Text>
              <Text style={{ color: '#CFE0FF', fontSize: 13 }}>
                High {formatTemp(tomorrow.high, tempUnit)} · Low {formatTemp(tomorrow.low, tempUnit)}
                {tomorrow.rainChance ? ` · ${tomorrow.rainChance}% rain` : ''}
              </Text>
            </View>
          </Pressable>
        ) : null}

        <View style={[styles.card, styles.row, { backgroundColor: c.card, borderColor: c.border, marginTop: 6 }]}>
          <Ionicons name="moon-outline" size={22} color={c.text} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 15, fontWeight: '800' }}>Every evening at 8 PM</Text>
            <Text style={{ color: c.tertiary, fontSize: 13 }}>A notification when your recap is ready</Text>
          </View>
          <Switch value={recapAlert} onValueChange={setRecapAlert} trackColor={{ true: c.accent, false: c.border }} thumbColor="#F5F5F7" accessibilityLabel="Evening recap notification" />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  hero: { backgroundColor: '#1A0E0A', gap: 12, padding: 18 },
  heroTitle: { color: '#F5F5F7', fontFamily: fonts.display, fontSize: 40, lineHeight: 41, textTransform: 'uppercase' },
  listen: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, padding: 12 },
  statValue: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38 },
  section: { fontFamily: fonts.heading, fontSize: 23, lineHeight: 25, textTransform: 'uppercase', marginTop: 10, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rank: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32, width: 22 },
  bar: { flex: 1, flexDirection: 'row', gap: 2, height: 6, borderRadius: 3, overflow: 'hidden' },
  game: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 22 },
});
