import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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
  /** Topics shown on the Following tab. */
  followed: Topic[];
}

interface SettingsValue {
  ready: boolean;
  enabledSources: SourceId[];
  isEnabled: (id: SourceId) => boolean;
  setSourceEnabled: (id: SourceId, on: boolean) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  notifyTopStories: boolean;
  setNotifyTopStories: (on: boolean) => void;
  followed: Topic[];
  isFollowing: (topic: Topic) => boolean;
  setFollowing: (topic: Topic, on: boolean) => void;
}

export const SETTINGS_KEY = 'settings:v1';
export const DEFAULT_SETTINGS: StoredSettings = { disabled: [], themeMode: 'system', notifyTopStories: true, followed: [] };
const KEY = SETTINGS_KEY;
const DEFAULTS = DEFAULT_SETTINGS;

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoredSettings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadJSON(KEY, DEFAULTS).then((s) => {
      setSettings({ ...DEFAULTS, ...s });
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
      followed: settings.followed,
      isFollowing: (topic) => settings.followed.includes(topic),
      setFollowing: (topic, on) =>
        update((s) => ({
          ...s,
          followed: on ? [...new Set([...s.followed, topic])] : s.followed.filter((t) => t !== topic),
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
