import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Linking } from 'react-native';

import { loadWeather, readCachedWeather } from '../services/localWeather';
import { WEATHER_TTL_MS, type Weather } from '../services/weather';
import { useSettings } from './SettingsContext';

/** `ask`: not asked yet (or asked once and Android still allows asking). `blocked`: only Settings can turn it on. */
export type LocationAccess = 'checking' | 'ask' | 'granted' | 'blocked';

interface WeatherValue {
  access: LocationAccess;
  weather: Weather | null;
  loading: boolean;
  failed: boolean;
  /** Asks for location (or opens Settings when Android won't ask again), then loads the weather. */
  enable: () => Promise<void>;
  refresh: () => Promise<void>;
}

const WeatherContext = createContext<WeatherValue | null>(null);

function toAccess(p: Location.LocationPermissionResponse): LocationAccess {
  if (p.granted) return 'granted';
  return p.canAskAgain ? 'ask' : 'blocked';
}

/** One shared forecast for the header, the For you card and the Weather screen. */
export function WeatherProvider({ children }: { children: ReactNode }) {
  const { showWeather, ready } = useSettings();
  const [access, setAccess] = useState<LocationAccess>('checking');
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  const latest = useRef<Weather | null>(null);
  latest.current = weather;

  const load = useCallback(async (force: boolean) => {
    if (busy.current) return;
    if (!force && latest.current && Date.now() - latest.current.fetchedAt < WEATHER_TTL_MS) return;
    busy.current = true;
    setLoading(true);
    try {
      setWeather(await loadWeather());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  // Show the last forecast straight away, then check permission and refresh it.
  useEffect(() => {
    if (!ready || !showWeather) return;
    let cancelled = false;
    (async () => {
      const cached = await readCachedWeather();
      if (!cancelled && cached) setWeather((w) => w ?? cached);
      const p = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (cancelled) return;
      const a = p ? toAccess(p) : 'ask';
      setAccess(a);
      if (a === 'granted') await load(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, showWeather, load]);

  // Coming back to the app: pick up a permission granted in Settings, and refresh a stale forecast.
  useEffect(() => {
    if (!showWeather) return;
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      const p = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (!p) return;
      const a = toAccess(p);
      setAccess(a);
      if (a === 'granted') await load(false);
    });
    return () => sub.remove();
  }, [showWeather, load]);

  const enable = useCallback(async () => {
    if (access === 'blocked') {
      await Linking.openSettings().catch(() => {});
      return;
    }
    const p = await Location.requestForegroundPermissionsAsync().catch(() => null);
    const a = p ? toAccess(p) : 'ask';
    setAccess(a);
    if (a === 'granted') await load(true);
  }, [access, load]);

  const refresh = useCallback(() => load(true), [load]);

  const value = useMemo<WeatherValue>(
    () => ({ access, weather: showWeather ? weather : null, loading, failed, enable, refresh }),
    [access, weather, showWeather, loading, failed, enable, refresh],
  );
  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export function useWeather(): WeatherValue {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error('useWeather must be used inside WeatherProvider');
  return ctx;
}
