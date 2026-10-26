import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as BackgroundTask from 'expo-background-task';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { SOURCE_IDS } from '../sources';
import { DEFAULT_SETTINGS, SETTINGS_KEY, type StoredSettings } from '../state/SettingsContext';
import type { Story } from '../types';
import { checkForUpdate, updatesEnabled } from './appUpdate';
import { loadTopic } from './news';

// Local notifications only: a background task fetches the Top feeds on the phone and posts a
// notification for a new story or a new app version. No push server is involved.

const TASK = 'headlines-background-check';
// A channel's importance can't change once created, so the higher-priority one has a new id.
const STORIES_CHANNEL = 'top-stories-alerts';
const OLD_STORIES_CHANNEL = 'top-stories';
const UPDATES_CHANNEL = 'app-updates';
const LAST_SEEN_KEY = 'notify:lastSeen:v1';
const UPDATE_NOTIFIED_KEY = 'notify:updateNotified:v1';
const REGISTERED_KEY = 'notify:registeredFor:v1';
// Android's minimum. It's a lower bound: the system may wait longer to save battery.
const INTERVAL_MINUTES = 15;
// Stories older than this when first seen are not "new" (e.g. after the phone was off all day).
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export type NotificationData = { kind: 'story'; story: Story } | { kind: 'update' };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
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

function channel(id: string) {
  return Platform.OS === 'android' ? { channelId: id } : null;
}

/** Posts a notification for stories published since the last check. Returns how many were new. */
async function notifyNewStories(settings: StoredSettings): Promise<number> {
  const enabled = SOURCE_IDS.filter((id) => !settings.disabled.includes(id));
  const { stories } = await loadTopic('top', enabled, true);
  const newest = stories[0]?.publishedAt ?? 0;
  if (!newest) return 0;

  const lastSeen = Number(await AsyncStorage.getItem(LAST_SEEN_KEY)) || Date.now() - 60 * 60 * 1000;
  await AsyncStorage.setItem(LAST_SEEN_KEY, String(Math.max(lastSeen, newest)));

  const fresh = stories.filter((s) => s.publishedAt > lastSeen && Date.now() - s.publishedAt < MAX_AGE_MS);
  const top = fresh[0];
  if (!top) return 0;
  const more = fresh.length - 1;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${top.sourceName}${more > 0 ? `  ·  +${more} more` : ''}`,
      body: top.title,
      data: { kind: 'story', story: top } satisfies NotificationData,
    },
    trigger: channel(STORIES_CHANNEL),
  });
  return fresh.length;
}

/** Posts one notification per new app version. Returns true if it posted. */
async function notifyAppUpdate(): Promise<boolean> {
  if (!updatesEnabled()) return false;
  const update = await checkForUpdate();
  if (!update) return false;
  if (Number(await AsyncStorage.getItem(UPDATE_NOTIFIED_KEY)) === update.versionCode) return false;
  await AsyncStorage.setItem(UPDATE_NOTIFIED_KEY, String(update.versionCode));
  const highlights = update.whatsNew.slice(0, 2).join(' · ');
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `News Hammer ${update.versionName} is available`,
      body: highlights || 'Open the app to install the update.',
      data: { kind: 'update' } satisfies NotificationData,
    },
    trigger: channel(UPDATES_CHANNEL),
  });
  return true;
}

/** One background check: new stories and new app versions, each if turned on in Settings. */
export async function runCheck(): Promise<{ stories: number; update: boolean }> {
  const settings = await readSettings();
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return { stories: 0, update: false };
  const [stories, update] = await Promise.allSettled([
    settings.notifyTopStories ? notifyNewStories(settings) : Promise.resolve(0),
    settings.notifyUpdates ? notifyAppUpdate() : Promise.resolve(false),
  ]);
  return {
    stories: stories.status === 'fulfilled' ? stories.value : 0,
    update: update.status === 'fulfilled' ? update.value : false,
  };
}

// Must be defined at module load (imported from index.ts) so it exists when Android wakes the app.
TaskManager.defineTask(TASK, async () => {
  try {
    await runCheck();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.deleteNotificationChannelAsync(OLD_STORIES_CHANNEL).catch(() => {});
  await Notifications.setNotificationChannelAsync(STORIES_CHANNEL, {
    name: 'New top stories',
    importance: Notifications.AndroidImportance.HIGH,
  });
  await Notifications.setNotificationChannelAsync(UPDATES_CHANNEL, {
    name: 'App updates',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * Creates channels, asks for permission once, and (re)registers the background check. Registration
 * is redone once per installed version so a changed interval takes effect after an update.
 */
export async function setUpNotifications(): Promise<boolean> {
  await ensureChannels();
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  const granted = status === 'granted';
  if (!granted) return false;

  // Stories from before the app was first set up aren't news to the user.
  if (!(await AsyncStorage.getItem(LAST_SEEN_KEY))) await AsyncStorage.setItem(LAST_SEEN_KEY, String(Date.now()));

  const marker = `${Application.nativeBuildVersion ?? 'dev'}:${INTERVAL_MINUTES}`;
  const registered = await TaskManager.isTaskRegisteredAsync(TASK);
  if (!registered || (await AsyncStorage.getItem(REGISTERED_KEY)) !== marker) {
    if (registered) await BackgroundTask.unregisterTaskAsync(TASK).catch(() => {});
    await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: INTERVAL_MINUTES });
    await AsyncStorage.setItem(REGISTERED_KEY, marker);
  }
  return true;
}

/** Shows a sample notification so the user can confirm notifications reach the phone. */
export async function sendTestNotification(): Promise<boolean> {
  const granted = await setUpNotifications();
  if (!granted) return false;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'News Hammer',
      body: "Notifications are working. You'll hear about new top stories and app updates.",
    },
    trigger: channel(STORIES_CHANNEL),
  });
  return true;
}

/**
 * Opens Android's prompt to let the app ignore battery optimisation. Samsung phones in particular
 * put background work to sleep, which delays or stops the news checks.
 */
export async function requestBackgroundAccess(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync('android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', {
      data: `package:${Application.applicationId}`,
    });
  } catch {
    await IntentLauncher.startActivityAsync('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(() => {});
  }
}
