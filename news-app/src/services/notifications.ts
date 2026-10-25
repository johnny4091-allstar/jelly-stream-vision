import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { SOURCE_IDS } from '../sources';
import { DEFAULT_SETTINGS, SETTINGS_KEY, type StoredSettings } from '../state/SettingsContext';
import type { Story } from '../types';
import { checkForUpdate, updatesEnabled } from './appUpdate';
import { loadTopic } from './news';

// Local notifications only: a background task fetches the Top feeds on the phone and posts a
// notification for a new story. No push server is involved.

const TASK = 'headlines-background-check';
const STORIES_CHANNEL = 'top-stories';
const UPDATES_CHANNEL = 'app-updates';
const LAST_SEEN_KEY = 'notify:lastSeen:v1';
const UPDATE_NOTIFIED_KEY = 'notify:updateNotified:v1';
// Android treats this as a minimum; the system may run the check less often to save battery.
const INTERVAL_MINUTES = 30;
// Stories older than this when first seen are not "new" (e.g. after the phone was off all day).
const MAX_AGE_MS = 3 * 60 * 60 * 1000;

export type NotificationData = { kind: 'story'; story: Story } | { kind: 'update' };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function readSettings(): Promise<StoredSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(raw ? (JSON.parse(raw) as Partial<StoredSettings>) : {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function notifyNewStories(settings: StoredSettings): Promise<void> {
  if (!settings.notifyTopStories) return;
  const enabled = SOURCE_IDS.filter((id) => !settings.disabled.includes(id));
  const { stories } = await loadTopic('top', enabled, true);
  const newest = stories[0]?.publishedAt ?? 0;
  if (!newest) return;

  const lastSeen = Number(await AsyncStorage.getItem(LAST_SEEN_KEY)) || 0;
  await AsyncStorage.setItem(LAST_SEEN_KEY, String(Math.max(lastSeen, newest)));
  // First run just sets the baseline, so installing the app doesn't fire off old news.
  if (!lastSeen) return;

  const fresh = stories.filter((s) => s.publishedAt > lastSeen && Date.now() - s.publishedAt < MAX_AGE_MS);
  const top = fresh[0];
  if (!top) return;
  const more = fresh.length - 1;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: top.sourceName,
      body: more > 0 ? `${top.title}\n+${more} more new ${more === 1 ? 'story' : 'stories'}` : top.title,
      data: { kind: 'story', story: top } satisfies NotificationData,
    },
    trigger: Platform.OS === 'android' ? { channelId: STORIES_CHANNEL } : null,
  });
}

async function notifyAppUpdate(): Promise<void> {
  if (!updatesEnabled()) return;
  const update = await checkForUpdate();
  if (!update) return;
  if (Number(await AsyncStorage.getItem(UPDATE_NOTIFIED_KEY)) === update.versionCode) return;
  await AsyncStorage.setItem(UPDATE_NOTIFIED_KEY, String(update.versionCode));
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Headlines update available',
      body: `Version ${update.versionName} is ready. Open the app to install it.`,
      data: { kind: 'update' } satisfies NotificationData,
    },
    trigger: Platform.OS === 'android' ? { channelId: UPDATES_CHANNEL } : null,
  });
}

// Must be defined at module load (imported from index.ts) so it exists when Android wakes the app.
TaskManager.defineTask(TASK, async () => {
  try {
    const settings = await readSettings();
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') {
      await Promise.allSettled([notifyNewStories(settings), notifyAppUpdate()]);
    }
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Creates channels, asks for permission once, and keeps the background check registered. */
export async function setUpNotifications(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(STORIES_CHANNEL, {
      name: 'New top stories',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync(UPDATES_CHANNEL, {
      name: 'App updates',
      importance: Notifications.AndroidImportance.LOW,
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  const granted = status === 'granted';

  const registered = await TaskManager.isTaskRegisteredAsync(TASK);
  if (granted && !registered) {
    await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: INTERVAL_MINUTES });
  }
  return granted;
}
