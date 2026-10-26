// Weather from Open-Meteo (free, no API key). Kept free of React Native imports so CI can run the
// forecast request in Node; finding the phone's location is in localWeather.ts.

export interface Coords {
  latitude: number;
  longitude: number;
}

export interface HourForecast {
  /** Milliseconds since epoch (start of the hour, local to the forecast place). */
  time: number;
  temp: number;
  code: number;
  isDay: boolean;
  rainChance: number;
}

export interface DayForecast {
  /** "YYYY-MM-DD" in the forecast place's time zone. */
  date: string;
  high: number;
  low: number;
  code: number;
  rainChance: number;
}

/** Temperatures are in °C and wind in km/h; the UI converts for display. */
export interface Weather {
  fetchedAt: number;
  place: string;
  /** Where the forecast is for; also centres the radar. Missing from forecasts cached by 1.0.23. */
  coords?: Coords;
  current: { temp: number; feelsLike: number; code: number; isDay: boolean; humidity: number; wind: number };
  hourly: HourForecast[];
  daily: DayForecast[];
}

export const WEATHER_TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12_000;

interface Condition {
  label: string;
  /** Ionicons names for day and night. */
  day: string;
  night: string;
}

const SUN: Condition = { label: 'Clear', day: 'sunny', night: 'moon' };
const CONDITIONS: [number[], Condition][] = [
  [[0], SUN],
  [[1], { label: 'Mostly clear', day: 'partly-sunny', night: 'cloudy-night' }],
  [[2], { label: 'Partly cloudy', day: 'partly-sunny', night: 'cloudy-night' }],
  [[3], { label: 'Cloudy', day: 'cloudy', night: 'cloudy' }],
  [[45, 48], { label: 'Fog', day: 'cloudy', night: 'cloudy' }],
  [[51, 53, 55, 56, 57], { label: 'Drizzle', day: 'rainy', night: 'rainy' }],
  [[61, 63, 66, 80, 81], { label: 'Rain', day: 'rainy', night: 'rainy' }],
  [[65, 67, 82], { label: 'Heavy rain', day: 'rainy', night: 'rainy' }],
  [[71, 73, 77, 85], { label: 'Snow', day: 'snow', night: 'snow' }],
  [[75, 86], { label: 'Heavy snow', day: 'snow', night: 'snow' }],
  [[95, 96, 99], { label: 'Thunderstorms', day: 'thunderstorm', night: 'thunderstorm' }],
];

/** WMO weather code (as Open-Meteo reports it) to a label and icon. */
export function condition(code: number): Condition {
  return CONDITIONS.find(([codes]) => codes.includes(code))?.[1] ?? SUN;
}

export function conditionIcon(code: number, isDay = true): string {
  const c = condition(code);
  return isDay ? c.day : c.night;
}

export type TempUnit = 'f' | 'c';

/** Fahrenheit where it's the everyday unit (US and a few others), Celsius elsewhere. */
export function defaultTempUnit(): TempUnit {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return /-(US|LR|MM|BS|BZ|KY|PW|FM|MH)\b/i.test(locale) ? 'f' : 'c';
  } catch {
    return 'f';
  }
}

export function formatTemp(celsius: number, unit: TempUnit): string {
  return `${Math.round(unit === 'f' ? celsius * 1.8 + 32 : celsius)}°`;
}

export function formatWind(kmh: number, unit: TempUnit): string {
  return unit === 'f' ? `${Math.round(kmh / 1.609)} mph` : `${Math.round(kmh)} km/h`;
}

async function getJSON<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

interface OpenMeteo {
  utc_offset_seconds: number;
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    is_day: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
  };
  hourly: { time: number[]; temperature_2m: number[]; weather_code: number[]; is_day: number[]; precipitation_probability: (number | null)[] };
  daily: {
    /** With timeformat=unixtime these are numbers too: midnight at the place, in seconds. */
    time: (number | string)[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
  };
}

/** Forecast for a spot: now, the next 24 hours and the next 7 days. */
export async function fetchForecast(coords: Coords): Promise<Omit<Weather, 'place' | 'fetchedAt'>> {
  const params = [
    // Rounded to about 1 km: plenty for a forecast, and all Open-Meteo learns about where you are.
    `latitude=${coords.latitude.toFixed(2)}`,
    `longitude=${coords.longitude.toFixed(2)}`,
    'current=temperature_2m,apparent_temperature,weather_code,is_day,relative_humidity_2m,wind_speed_10m',
    'hourly=temperature_2m,weather_code,is_day,precipitation_probability',
    'daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    'timezone=auto',
    'timeformat=unixtime',
    'forecast_days=7',
  ].join('&');
  const data = await getJSON<OpenMeteo>(`https://api.open-meteo.com/v1/forecast?${params}`);

  const now = Date.now();
  const hourly: HourForecast[] = [];
  data.hourly.time.forEach((t, i) => {
    const time = t * 1000;
    // From the current hour on, for a day.
    if (time < now - 60 * 60 * 1000 || hourly.length >= 24) return;
    hourly.push({
      time,
      temp: data.hourly.temperature_2m[i] ?? 0,
      code: data.hourly.weather_code[i] ?? 0,
      isDay: data.hourly.is_day[i] === 1,
      rainChance: data.hourly.precipitation_probability[i] ?? 0,
    });
  });

  return {
    current: {
      temp: data.current.temperature_2m,
      feelsLike: data.current.apparent_temperature,
      code: data.current.weather_code,
      isDay: data.current.is_day === 1,
      humidity: data.current.relative_humidity_2m,
      wind: data.current.wind_speed_10m,
    },
    hourly,
    daily: data.daily.time.map((t, i) => ({
      date: typeof t === 'number' ? new Date((t + data.utc_offset_seconds) * 1000).toISOString().slice(0, 10) : t,
      high: data.daily.temperature_2m_max[i] ?? 0,
      low: data.daily.temperature_2m_min[i] ?? 0,
      code: data.daily.weather_code[i] ?? 0,
      rainChance: data.daily.precipitation_probability_max[i] ?? 0,
    })),
  };
}
