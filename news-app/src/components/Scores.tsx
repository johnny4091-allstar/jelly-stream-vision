import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { openWatch } from '../navigation';
import { fetchGames, type Game } from '../services/scores';
import { useSettings } from '../state/SettingsContext';
import { useTheme } from '../theme';

let lastGames: Game[] | null = null;

/** Today's games; every 30 seconds while one is live, every 5 minutes otherwise. */
export function useGames(): { games: Game[] | null; refresh: () => Promise<void> } {
  const { favoriteTeams } = useSettings();
  const [games, setGames] = useState<Game[] | null>(lastGames);
  const key = favoriteTeams.join(',');

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      clearTimeout(timer);
      if (AppState.currentState === 'active') {
        const g = await fetchGames(key ? key.split(',') : []).catch(() => null);
        if (cancelled) return;
        if (g) {
          lastGames = g;
          setGames(g);
        } else setGames((prev) => prev ?? []);
      }
      const live = lastGames?.some((x) => x.state === 'in');
      timer = setTimeout(load, live ? 30_000 : 300_000);
    };
    load();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && load());
    return () => {
      cancelled = true;
      clearTimeout(timer);
      sub.remove();
    };
  }, [key]);

  return {
    games,
    refresh: async () => {
      const g = await fetchGames(key ? key.split(',') : []).catch(() => null);
      if (g) {
        lastGames = g;
        setGames(g);
      }
    },
  };
}

export function StatusText({ game, small }: { game: Game; small?: boolean }) {
  const c = useTheme();
  const live = game.state === 'in';
  return (
    <Text style={[small ? styles.statusSmall : styles.status, { color: live ? '#E5383B' : c.tertiary }]} numberOfLines={1}>
      {live ? '● ' : ''}
      {game.detail}
    </Text>
  );
}

/** One game: logos, abbreviations, scores and the clock. The star pins a team to the top. */
export function GameRow({ game }: { game: Game }) {
  const c = useTheme();
  const { favoriteTeams, toggleFavoriteTeam } = useSettings();
  const line = (t: Game['home']) => {
    const fav = favoriteTeams.includes(t.abbr);
    return (
      <View style={styles.teamLine}>
        {t.logo ? <Image source={{ uri: t.logo }} style={styles.logo} contentFit="contain" /> : <View style={styles.logo} />}
        <Text style={[styles.teamName, { color: c.text, opacity: game.state === 'post' && !t.winner ? 0.55 : 1 }]} numberOfLines={1}>
          {t.name || t.abbr}
        </Text>
        <Pressable onPress={() => toggleFavoriteTeam(t.abbr)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${fav ? 'Unpin' : 'Pin'} ${t.name}`}>
          <Ionicons name={fav ? 'star' : 'star-outline'} size={16} color={fav ? '#F5A623' : c.tertiary} />
        </Pressable>
        <Text style={[styles.score, { color: c.text, opacity: game.state === 'post' && !t.winner ? 0.55 : 1 }]}>
          {game.state === 'pre' ? '' : t.score}
        </Text>
      </View>
    );
  };
  return (
    <Pressable
      onPress={() => game.link && openWatch(game.link, `${game.away.abbr} at ${game.home.abbr}`)}
      style={[styles.game, { backgroundColor: c.card }]}
      accessibilityRole="button"
      accessibilityLabel={`${game.away.name} ${game.away.score} at ${game.home.name} ${game.home.score}, ${game.detail}`}
    >
      <View style={styles.gameTop}>
        <Text style={[styles.league, { color: c.tertiary }]}>{game.leagueName}</Text>
        <StatusText game={game} small />
      </View>
      {line(game.away)}
      {line(game.home)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  status: { fontSize: 13, fontWeight: '800' },
  statusSmall: { fontSize: 12, fontWeight: '800' },
  game: { marginHorizontal: 12, marginBottom: 8, borderRadius: 18, padding: 14, gap: 8 },
  gameTop: { flexDirection: 'row', justifyContent: 'space-between' },
  league: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  teamLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 26, height: 26 },
  teamName: { flex: 1, fontSize: 16, fontWeight: '700' },
  score: { width: 40, textAlign: 'right', fontSize: 18, fontWeight: '800' },
});
