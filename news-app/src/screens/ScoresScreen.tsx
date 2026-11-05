import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StackHeader } from '../components/common';
import { GameRow, useGames } from '../components/Scores';
import { LEAGUES } from '../services/scores';
import { useTheme } from '../theme';

/** Today's games in every league, live first. Star a team to keep its games at the top. */
export function ScoresScreen() {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { games, refresh } = useGames();
  const [league, setLeague] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const leagues = LEAGUES.filter((l) => games?.some((g) => g.league === l.id));
  const shown = (games ?? []).filter((g) => !league || g.league === league);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <StackHeader title="Scores" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
            }}
            tintColor={c.tertiary}
          />
        }
      >
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
                style={[styles.chip, { backgroundColor: active ? c.chipActive : c.chip }]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={{ color: active ? c.chipActiveText : c.chipText, fontWeight: '700' }}>{l.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {games === null ? <ActivityIndicator style={{ marginTop: 40 }} color={c.tertiary} /> : null}
        {games !== null && shown.length === 0 ? (
          <Text style={[styles.empty, { color: c.secondary }]}>No games today.</Text>
        ) : null}
        {shown.map((g) => (
          <GameRow key={g.id} game={g} />
        ))}
        <Text style={[styles.note, { color: c.tertiary }]}>Scores from ESPN. Tap a game for the box score; tap ☆ to pin a team.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { paddingHorizontal: 12, gap: 8, paddingVertical: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 15 },
  note: { fontSize: 12, textAlign: 'center', marginTop: 12, marginHorizontal: 20 },
});
