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

/** Where the phone is. A recent fix is good enough for weather and much faster than a new one. */
async function currentCoords(): Promise<Coords> {
  const last = await Location.getLastKnownPositionAsync({ maxAge: WEATHER_TTL_MS }).catch(() => null);
  const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
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
