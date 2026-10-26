// Fetches a forecast the way the app does, so a change in Open-Meteo's API shows up in the CI log.
import { condition, fetchForecast, formatTemp } from '../src/services/weather.ts';

const places = [
  ['New York', { latitude: 40.71, longitude: -74.01 }],
  ['London', { latitude: 51.51, longitude: -0.13 }],
];
for (const [name, coords] of places) {
  try {
    const w = await fetchForecast(coords);
    const today = w.daily[0];
    console.log(
      `${name.padEnd(10)} ${formatTemp(w.current.temp, 'f')} ${condition(w.current.code).label}, ` +
        `H ${formatTemp(today.high, 'f')} L ${formatTemp(today.low, 'f')}, ${w.hourly.length} hours, ${w.daily.length} days`,
    );
  } catch (err) {
    console.log(`::warning::Weather for ${name} failed: ${err instanceof Error ? err.message : err}`);
  }
}
