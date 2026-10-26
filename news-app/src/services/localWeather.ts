import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import { WEATHER_TTL_MS, fetchForecast, type Coords, type Weather } from './weather';

// The weather where the phone is. The place name comes from the phone's own geocoder.

const CACHE_KEY = 'weather:v1';
const COORDS_KEY = 'weather:coords:v1';

async function placeName(coords: Coords): Promise<string> {
  try {
    const [a] = await Location.reverseGeocodeAsync(coords);
    return a?.city || a?.district || a?.subregion || a?.region || '';
  } catch {
    return '';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} timed out`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/**
 * Where the phone is. A recent fix is good enough for weather and much faster than a new one.
 * Otherwise ask for a fix (network first, then GPS), and as a last resort take an older one.
 * Each step has a time limit so a phone indoors never leaves the card spinning.
 */
async function currentCoords(): Promise<Coords> {
  const recent = await Location.getLastKnownPositionAsync({ maxAge: WEATHER_TTL_MS }).catch(() => null);
  const pos =
    recent ??
    (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 15_000, 'Location').catch(
      () => null,
    )) ??
    (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), 20_000, 'GPS').catch(
      () => null,
    )) ??
    (await Location.getLastKnownPositionAsync().catch(() => null));
  if (!pos) throw new Error('No location fix');
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
}

export async function readCachedWeather(): Promise<Weather | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Weather) : null;
  } catch {
    return null;
  }
}

/** Gets the location (permission must already be granted), then the forecast, and caches it. */
export async function loadWeather(): Promise<Weather> {
  let coords: Coords;
  try {
    coords = await currentCoords();
    await AsyncStorage.setItem(COORDS_KEY, JSON.stringify(coords)).catch(() => {});
  } catch (err) {
    // Location off or no fix indoors: the last place we knew still gives a useful forecast.
    const raw = await AsyncStorage.getItem(COORDS_KEY).catch(() => null);
    if (!raw) throw err;
    coords = JSON.parse(raw) as Coords;
  }
  const [forecast, place] = await Promise.all([fetchForecast(coords), placeName(coords)]);
  const weather: Weather = { ...forecast, place, coords, fetchedAt: Date.now() };
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(weather)).catch(() => {});
  return weather;
}
