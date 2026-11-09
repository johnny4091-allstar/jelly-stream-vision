import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { findCoverage } from '../services/coverage';
import { readCachedWeather } from '../services/localWeather';
import { loadTopic, pickTopStories } from '../services/news';
import { fetchGames, type Game } from '../services/scores';
import { defaultTempUnit, fetchForecast } from '../services/weather';
import { SOURCE_IDS } from '../sources';
import { DEFAULT_SETTINGS, SETTINGS_KEY, type StoredSettings } from '../state/SettingsContext';
import { TeamWidget, TopStoryWidget, WeatherWidget } from './NewsWidgets';

export const WIDGET_NAMES = ['TopStory', 'Weather', 'YourTeam'] as const;
export type WidgetName = (typeof WIDGET_NAMES)[number];

async function readSettings(): Promise<StoredSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(raw ? (JSON.parse(raw) as Partial<StoredSettings>) : {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Live first, then a recent final, then the next game. */
function teamGame(games: Game[], favorites: string[]): Game | null {
  const mine = games.filter((g) => favorites.includes(g.home.abbr) || favorites.includes(g.away.abbr));
  return mine.find((g) => g.state === 'in') ?? mine.find((g) => g.state === 'post') ?? mine.find((g) => g.state === 'pre') ?? null;
}

/** Builds one widget from cached or freshly loaded data. Runs inside the app or headless. */
export async function buildWidget(name: string) {
  const settings = await readSettings();
  if (name === 'Weather') {
    let weather = settings.showWeather ? await readCachedWeather() : null;
    // The forecast for the last known place, refreshed hourly without asking for location.
    if (weather?.coords && Date.now() - weather.fetchedAt > 60 * 60 * 1000) {
      const fresh = await fetchForecast(weather.coords).catch(() => null);
      if (fresh) weather = { ...weather, ...fresh, fetchedAt: Date.now() };
    }
    return <WeatherWidget weather={weather} unit={settings.tempUnit ?? defaultTempUnit()} />;
  }
  if (name === 'YourTeam') {
    const games = settings.favoriteTeams.length ? await fetchGames(settings.favoriteTeams).catch(() => []) : [];
    return <TeamWidget game={teamGame(games, settings.favoriteTeams)} hasTeams={settings.favoriteTeams.length > 0} />;
  }
  const enabled = SOURCE_IDS.filter((id) => !settings.disabled.includes(id));
  const { stories } = await loadTopic('top', enabled).catch(() => ({ stories: [] }));
  const withImages = stories.filter((s) => s.imageUrl);
  const story = pickTopStories(withImages.length ? withImages : stories, 1)[0] ?? null;
  return <TopStoryWidget story={story} outlets={story ? findCoverage(story, stories).outlets : 0} />;
}

/** Android calls this when a widget is added, resized or due for its 30-minute refresh. */
export async function widgetTaskHandler({ widgetInfo, widgetAction, renderWidget }: WidgetTaskHandlerProps): Promise<void> {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  renderWidget(await buildWidget(widgetInfo.widgetName));
}
