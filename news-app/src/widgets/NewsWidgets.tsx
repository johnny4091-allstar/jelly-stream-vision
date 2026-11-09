import { FlexWidget, ImageWidget, TextWidget } from 'react-native-android-widget';

import type { Game } from '../services/scores';
import { condition, formatTemp, type TempUnit, type Weather } from '../services/weather';
import type { Story } from '../types';

// Home screen widgets. These render natively (Android RemoteViews), so only the widget library's
// components work here: FlexWidget, TextWidget, ImageWidget.

const INK = '#0B0B0D';
const HAMMER = '#FF5A1F';
const TEXT = '#F5F5F7';
const DIM = '#9A9AA3';
const HEADING = 'BarlowCondensed_800ExtraBold';
const DISPLAY = 'BarlowCondensed_900Black';

function Shell({ children, background = INK, label }: { children: React.ReactNode; background?: `#${string}`; label: string }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel={label}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: background, borderRadius: 24, padding: 14 }}
    >
      {children}
    </FlexWidget>
  );
}

function Label({ text, color = HAMMER }: { text: string; color?: `#${string}` }) {
  return <TextWidget text={text.toUpperCase()} style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.12, color }} maxLines={1} />;
}

/** The newest big story, how many outlets have it, and its picture. */
export function TopStoryWidget({ story, outlets }: { story: Story | null; outlets: number }) {
  if (!story)
    return (
      <Shell label="News Hammer">
        <Label text="News Hammer" />
        <TextWidget text="Open the app to load today's top story." style={{ fontSize: 15, color: TEXT, marginTop: 8 }} />
      </Shell>
    );
  return (
    <Shell label={`Top story: ${story.title}`}>
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', height: 'match_parent' }}>
        <FlexWidget style={{ flex: 1, height: 'match_parent', justifyContent: 'space-between', paddingRight: story.imageUrl ? 12 : 0 }}>
          <Label text="Top story" />
          <TextWidget text={story.title} maxLines={3} truncate="END" style={{ fontFamily: HEADING, fontSize: 22, color: TEXT, marginTop: 4 }} />
          <TextWidget
            text={`${story.sourceName}${outlets > 1 ? `  ·  ${outlets} outlets` : ''}`}
            maxLines={1}
            style={{ fontSize: 12, fontWeight: '700', color: outlets > 1 ? HAMMER : DIM, marginTop: 4 }}
          />
        </FlexWidget>
        {story.imageUrl?.startsWith('http') ? (
          <ImageWidget image={story.imageUrl as `https:${string}`} imageWidth={96} imageHeight={96} radius={16} resizeMode="cover" />
        ) : null}
      </FlexWidget>
    </Shell>
  );
}

/** Temperature and conditions where the phone was last. */
export function WeatherWidget({ weather, unit }: { weather: Weather | null; unit: TempUnit }) {
  if (!weather)
    return (
      <Shell label="Weather" background="#16233F">
        <Label text="Weather" color="#A9BBDB" />
        <TextWidget text="Turn on weather in News Hammer." style={{ fontSize: 14, color: TEXT, marginTop: 8 }} />
      </Shell>
    );
  const today = weather.daily[0];
  const rain = weather.hourly.slice(1, 13).find((h) => h.rainChance >= 50);
  const rainHour = rain ? new Date(rain.time).getHours() : 0;
  return (
    <Shell label={`Weather: ${formatTemp(weather.current.temp, unit)}, ${condition(weather.current.code).label}`} background="#16233F">
      <FlexWidget style={{ height: 'match_parent', width: 'match_parent', justifyContent: 'space-between' }}>
        <Label text={weather.place || 'Weather'} color="#A9BBDB" />
        <TextWidget text={formatTemp(weather.current.temp, unit)} style={{ fontFamily: DISPLAY, fontSize: 52, color: TEXT }} />
        <FlexWidget>
          <TextWidget text={condition(weather.current.code).label} maxLines={1} style={{ fontSize: 14, fontWeight: '700', color: TEXT }} />
          <TextWidget
            text={rain ? `Rain around ${rainHour % 12 || 12}${rainHour < 12 ? 'am' : 'pm'}` : today ? `H ${formatTemp(today.high, unit)}  L ${formatTemp(today.low, unit)}` : ''}
            maxLines={1}
            style={{ fontSize: 12, color: '#CFE0FF' }}
          />
        </FlexWidget>
      </FlexWidget>
    </Shell>
  );
}

/** Your starred team's game: live, final, or next. */
export function TeamWidget({ game, hasTeams }: { game: Game | null; hasTeams: boolean }) {
  if (!game)
    return (
      <Shell label="Your team">
        <Label text="Your team" />
        <TextWidget
          text={hasTeams ? 'No game today.' : 'Star a team on the Scores tab.'}
          style={{ fontSize: 14, color: TEXT, marginTop: 8 }}
        />
      </Shell>
    );
  const live = game.state === 'in';
  const line = (t: Game['home']) => (
    <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between', marginTop: 2 }}>
      <TextWidget text={t.abbr} style={{ fontFamily: HEADING, fontSize: 26, color: game.state === 'post' && !t.winner ? DIM : TEXT }} />
      <TextWidget text={game.state === 'pre' ? '' : t.score} style={{ fontFamily: DISPLAY, fontSize: 26, color: game.state === 'post' && !t.winner ? DIM : TEXT }} />
    </FlexWidget>
  );
  return (
    <Shell label={`${game.away.name} ${game.away.score}, ${game.home.name} ${game.home.score}, ${game.detail}`}>
      <FlexWidget style={{ height: 'match_parent', width: 'match_parent', justifyContent: 'space-between' }}>
        <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', justifyContent: 'space-between' }}>
          <Label text={game.leagueName} color={DIM} />
          <TextWidget text={live ? `● ${game.detail}` : game.detail} maxLines={1} style={{ fontSize: 11, fontWeight: '800', color: live ? HAMMER : DIM }} />
        </FlexWidget>
        {line(game.away)}
        {line(game.home)}
      </FlexWidget>
    </Shell>
  );
}
