import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { EMPTY_ACTIVITY, mergeActivity, record, type Activity, type ActivityEvent } from '../services/activity';
import { defaultTempUnit, type TempUnit } from '../services/weather';
import { SOURCE_IDS } from '../sources';
import type { SourceId, Topic } from '../types';
import { loadJSON, saveJSON } from './storage';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface StoredSettings {
  /** Sources the user switched off. Stored as a deny-list so newly added sources start on. */
  disabled: SourceId[];
  themeMode: ThemeMode;
  /** Background alerts for new top stories (also read by the background task). */
  notifyTopStories: boolean;
  /** Notification when a new app version is published (also read by the background task). */
  notifyUpdates: boolean;
  /** Topics shown on the You tab. */
  followed: Topic[];
  /** Local weather on Today. Turning it off stops all location use. */
  showWeather: boolean;
  /** null until the user picks one: follows the phone's region. */
  tempUnit: TempUnit | null;
  /** Stock market prices on Today. */
  showMarkets: boolean;
  /** The podcast tile on Today (videos and podcasts are always on the Watch tab). */
  showMedia: boolean;
  /** Team abbreviations (ESPN's, e.g. "TB") whose games show first. */
  favoriteTeams: string[];
  /** Set once the v2 design (dark first) has been applied to this install's settings. */
  designV2?: boolean;
  /** Reading streak, counts and badges (synced with the account, merged, never lost). */
  activity: Activity;
  /** The 7 AM "your briefing is ready" notification. */
  briefingAlert: boolean;
}

interface SettingsValue {
  ready: boolean;
  /** Everything stored, for account sync. */
  snapshot: StoredSettings;
  /** Applies settings from another device (account sync). */
  applySynced: (s: Partial<StoredSettings>) => void;
  enabledSources: SourceId[];
  isEnabled: (id: SourceId) => boolean;
  setSourceEnabled: (id: SourceId, on: boolean) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  notifyTopStories: boolean;
  setNotifyTopStories: (on: boolean) => void;
  notifyUpdates: boolean;
  setNotifyUpdates: (on: boolean) => void;
  followed: Topic[];
  isFollowing: (topic: Topic) => boolean;
  setFollowing: (topic: Topic, on: boolean) => void;
  showWeather: boolean;
  setShowWeather: (on: boolean) => void;
  tempUnit: TempUnit;
  setTempUnit: (unit: TempUnit) => void;
  showMarkets: boolean;
  setShowMarkets: (on: boolean) => void;
  showMedia: boolean;
  setShowMedia: (on: boolean) => void;
  favoriteTeams: string[];
  toggleFavoriteTeam: (abbr: string) => void;
  activity: Activity;
  recordActivity: (event: ActivityEvent) => void;
  briefingAlert: boolean;
  setBriefingAlert: (on: boolean) => void;
}

export const SETTINGS_KEY = 'settings:v1';
export const DEFAULT_SETTINGS: StoredSettings = { disabled: [], themeMode: 'dark', notifyTopStories: true, notifyUpdates: true, followed: [], showWeather: true, tempUnit: null, showMarkets: true, showMedia: true, favoriteTeams: [], activity: EMPTY_ACTIVITY, briefingAlert: true };
const KEY = SETTINGS_KEY;
const DEFAULTS = DEFAULT_SETTINGS;

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoredSettings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadJSON(KEY, DEFAULTS).then((s) => {
      const loaded = { ...DEFAULTS, ...s, activity: mergeActivity(EMPTY_ACTIVITY, s.activity) };
      // The v2 design is dark first: move installs still on "match phone" to dark, once. Anyone can
      // pick light or "match phone" again in Settings.
      if (!loaded.designV2) {
        if (loaded.themeMode === 'system') loaded.themeMode = 'dark';
        loaded.designV2 = true;
        saveJSON(KEY, loaded);
      }
      setSettings(loaded);
      setReady(true);
    });
  }, []);

  const update = useCallback((fn: (s: StoredSettings) => StoredSettings) => {
    setSettings((prev) => {
      const next = fn(prev);
      saveJSON(KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<SettingsValue>(() => {
    const enabledSources = SOURCE_IDS.filter((id) => !settings.disabled.includes(id));
    return {
      ready,
      snapshot: settings,
      // Activity from another phone adds to this one's instead of replacing it.
      applySynced: (synced) => update((s) => ({ ...s, ...synced, activity: mergeActivity(s.activity, synced.activity) })),
      enabledSources,
      isEnabled: (id) => !settings.disabled.includes(id),
      setSourceEnabled: (id, on) =>
        update((s) => ({
          ...s,
          disabled: on ? s.disabled.filter((d) => d !== id) : [...new Set([...s.disabled, id])],
        })),
      themeMode: settings.themeMode,
      setThemeMode: (themeMode) => update((s) => ({ ...s, themeMode })),
      notifyTopStories: settings.notifyTopStories,
      setNotifyTopStories: (notifyTopStories) => update((s) => ({ ...s, notifyTopStories })),
      notifyUpdates: settings.notifyUpdates,
      setNotifyUpdates: (notifyUpdates) => update((s) => ({ ...s, notifyUpdates })),
      followed: settings.followed,
      isFollowing: (topic) => settings.followed.includes(topic),
      setFollowing: (topic, on) =>
        update((s) => ({
          ...s,
          followed: on ? [...new Set([...s.followed, topic])] : s.followed.filter((t) => t !== topic),
        })),
      showWeather: settings.showWeather,
      setShowWeather: (showWeather) => update((s) => ({ ...s, showWeather })),
      tempUnit: settings.tempUnit ?? defaultTempUnit(),
      setTempUnit: (tempUnit) => update((s) => ({ ...s, tempUnit })),
      showMarkets: settings.showMarkets,
      setShowMarkets: (showMarkets) => update((s) => ({ ...s, showMarkets })),
      showMedia: settings.showMedia,
      setShowMedia: (showMedia) => update((s) => ({ ...s, showMedia })),
      activity: settings.activity,
      recordActivity: (event) => update((s) => ({ ...s, activity: record(s.activity, event) })),
      briefingAlert: settings.briefingAlert,
      setBriefingAlert: (briefingAlert) => update((s) => ({ ...s, briefingAlert })),
      favoriteTeams: settings.favoriteTeams,
      toggleFavoriteTeam: (abbr) =>
        update((s) => ({
          ...s,
          favoriteTeams: s.favoriteTeams.includes(abbr) ? s.favoriteTeams.filter((t) => t !== abbr) : [...s.favoriteTeams, abbr],
        })),
    };
  }, [settings, ready, update]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
