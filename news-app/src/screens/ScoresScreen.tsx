import { useScrollToTop } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader, FollowButton, SectionHeader, useTabBarSpace } from '../components/common';
import { GameRow, StatusText, useGames } from '../components/Scores';
import { TopicSection } from '../components/TopicSection';
import { openTopic, openWatch } from '../navigation';
import { LEAGUES, type Game } from '../services/scores';
import { useSettings } from '../state/SettingsContext';
import { fonts, type, useTheme } from '../theme';

/** The game worth a big card: your team's (live first), else any live game. */
function featuredGame(games: Game[], favorites: string[]): Game | undefined {
  const mine = (g: Game) => favorites.includes(g.home.abbr) || favorites.includes(g.away.abbr);
  return games.find((g) => mine(g) && g.state === 'in') ?? games.find((g) => mine(g)) ?? games.find((g) => g.state === 'in');
}

function Featured({ game, mine }: { game: Game; mine: boolean }) {
  const c = useTheme();
  const side = (t: Game['home']) => (
    <View style={styles.side}>
      {t.logo ? <Image source={{ uri: t.logo }} style={styles.bigLogo} contentFit="contain" /> : <View style={[styles.bigLogo, { backgroundColor: c.elevated, borderRadius: 30 }]} />}
      <Text style={[styles.abbr, { color: c.text, opacity: game.state === 'post' && !t.winner ? 0.55 : 1 }]}>{t.abbr}</Text>
    </View>
  );
  return (
    <Pressable
      onPress={() => game.link && openWatch(game.link, `${game.away.abbr} at ${game.home.abbr}`)}
      accessibilityRole="button"
      accessibilityLabel={`${game.away.name} ${game.away.score} at ${game.home.name} ${game.home.score}, ${game.detail}`}
      style={[styles.featured, { backgroundColor: c.card, borderColor: game.state === 'in' ? c.accent : c.border }]}
    >
      <View style={styles.between}>
        <Text style={[type.eyebrow, { color: c.tertiary }]}>
          {game.leagueName}
          {mine ? ' · ★ Your team' : ''}
        </Text>
        <StatusText game={game} small />
      </View>
      <View style={styles.scoreRow}>
        {side(game.away)}
        <Text style={[styles.bigScore, { color: c.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {game.state === 'pre' ? 'VS' : `${game.away.score} – ${game.home.score}`}
        </Text>
        {side(game.home)}
      </View>
    </Pressable>
  );
}

/** Scores tab: your team's game big, today's games in every league, then sports news. */
export function ScoresScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarSpace();
  const { favoriteTeams } = useSettings();
  const { games, refresh } = useGames();
  const [league, setLeague] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const scrollRef = useRef<ScrollViewInstance>(null);
  useScrollToTop(scrollRef);
  const leagues = LEAGUES.filter((l) => games?.some((g) => g.league === l.id));
  const shown = (games ?? []).filter((g) => !league || g.league === league);
  const featured = league ? undefined : featuredGame(games ?? [], favoriteTeams);
  const mine = !!featured && (favoriteTeams.includes(featured.home.abbr) || favoriteTeams.includes(featured.away.abbr));

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: bottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              setRefreshKey((k) => k + 1);
              await refresh();
              setRefreshing(false);
            }}
            tintColor={c.tertiary}
            progressViewOffset={insets.top}
          />
        }
      >
        <AppHeader title="Scores" hideWeather />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {[{ id: null, name: 'All' }, ...leagues].map((l) => {
            const active = league === l.id;
            return (
              <Pressable
                key={l.id ?? 'all'}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setLeague(l.id);
                }}
                style={[styles.chip, { backgroundColor: active ? c.chipActive : c.chip, borderColor: active ? c.chipActive : c.border }]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={{ color: active ? c.chipActiveText : c.chipText, fontWeight: '800' }}>{l.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {featured ? <Featured game={featured} mine={mine} /> : null}
        {games === null ? <ActivityIndicator style={{ marginTop: 40 }} color={c.tertiary} /> : null}
        {games !== null && shown.length === 0 ? <Text style={[styles.empty, { color: c.secondary }]}>No games today.</Text> : null}
        {shown.filter((g) => g !== featured).map((g) => (
          <GameRow key={g.id} game={g} />
        ))}
        <Text style={[styles.note, { color: c.tertiary }]}>Scores from ESPN. Tap a game for the box score; tap ☆ to star a team.</Text>
        <SectionHeader title="Sports news" right={<FollowButton topic="sports" />} onPress={() => openTopic('sports')} />
        <TopicSection topic="sports" count={6} refreshToken={refreshKey} hideHeader />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { paddingHorizontal: 14, gap: 8, paddingBottom: 12 },
  chip: { borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 15, paddingVertical: 8 },
  featured: { marginHorizontal: 14, marginBottom: 12, borderRadius: 24, borderWidth: 1.5, padding: 18, gap: 14 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { width: 84, alignItems: 'center', gap: 6 },
  bigLogo: { width: 54, height: 54 },
  abbr: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 24 },
  bigScore: { flex: 1, textAlign: 'center', fontFamily: fonts.display, fontSize: 50, lineHeight: 54 },
  empty: { textAlign: 'center', marginTop: 30, fontSize: 15 },
  note: { fontSize: 12, textAlign: 'center', marginTop: 8, marginHorizontal: 20 },
});
