import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { NotificationData } from './notifications';
import type { Game } from './scores';

// Your team's live score as one quiet notification that stays on the lock screen and updates in
// place while the game is on (every 30 seconds with the app open, every ~15 minutes in the
// background), then shows the final once.

const ID = 'live-score';
const CHANNEL = 'live-scores';
const LAST_KEY = 'livescore:last:v1';

/** The favourite team's game worth showing: live first, then one that just finished. */
export function scoreGame(games: Game[], favorites: string[]): Game | undefined {
  const mine = games.filter((g) => favorites.includes(g.home.abbr) || favorites.includes(g.away.abbr));
  return mine.find((g) => g.state === 'in') ?? mine.find((g) => g.state === 'post' && Date.now() - g.start < 8 * 3600_000);
}

export async function updateLiveScore(games: Game[], favorites: string[], enabled: boolean): Promise<void> {
  if (Platform.OS === 'web') return;
  const game = enabled ? scoreGame(games, favorites) : undefined;
  const last = await AsyncStorage.getItem(LAST_KEY).catch(() => null);
  if (!game) {
    if (last?.endsWith(':in')) await Notifications.dismissNotificationAsync(ID).catch(() => {});
    return;
  }
  const key = `${game.id}:${game.state}`;
  // A final is shown once; a live game is refreshed every time the score or clock changes.
  if (game.state === 'post' && last === key) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Live scores',
      importance: Notifications.AndroidImportance.LOW,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: false,
    });
  const live = game.state === 'in';
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: {
      title: `${game.away.abbr} ${game.away.score}  –  ${game.home.score} ${game.home.abbr}`,
      body: `${live ? '● LIVE · ' : ''}${game.detail} · ${game.leagueName}`,
      data: { kind: 'score' } satisfies NotificationData,
      sticky: live,
      autoDismiss: !live,
      priority: Notifications.AndroidNotificationPriority.LOW,
    },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
  });
  await AsyncStorage.setItem(LAST_KEY, key).catch(() => {});
}
