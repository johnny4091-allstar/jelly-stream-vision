// Free live news channels. Each one is the broadcaster's own 24/7 live stream on YouTube, played
// with YouTube's embedded player, so the app never hosts or re-streams video.

export interface LiveChannel {
  id: string;
  name: string;
  /** Short wordmark shown on the tile. */
  short: string;
  description: string;
  /** YouTube channel id; the embed plays whatever that channel is streaming live. */
  youtubeChannelId: string;
  color: string;
}

export const LIVE_CHANNELS: LiveChannel[] = [
  {
    id: 'abc',
    name: 'ABC News Live',
    short: 'abc NEWS LIVE',
    description: 'US and world news around the clock',
    youtubeChannelId: 'UCBi2mrWuNuyYy4gbM6fW3_A',
    color: '#003DA5',
  },
  {
    id: 'nbc',
    name: 'NBC News NOW',
    short: 'NBC NEWS NOW',
    description: 'Breaking news and live coverage',
    youtubeChannelId: 'UCeY0bbntWzzVIaj2z3QigXg',
    color: '#4B2E83',
  },
  {
    id: 'cbs',
    name: 'CBS News 24/7',
    short: 'CBS NEWS 24/7',
    description: 'Live reporting from CBS News',
    youtubeChannelId: 'UC8p1vwvWtl6T73JiExfWs1g',
    color: '#111111',
  },
  {
    id: 'sky',
    name: 'Sky News',
    short: 'SKY NEWS',
    description: 'UK and international news',
    youtubeChannelId: 'UCoMdktPbSTixAyNGwb-UYkQ',
    color: '#C8102E',
  },
  {
    id: 'aje',
    name: 'Al Jazeera English',
    short: 'AL JAZEERA',
    description: 'Global news from Doha',
    youtubeChannelId: 'UCNye-wNBqNL5ZzHSJj3l8Bg',
    color: '#D98F00',
  },
  {
    id: 'dw',
    name: 'DW News',
    short: 'DW NEWS',
    description: "Germany's international broadcaster",
    youtubeChannelId: 'UCknLrEdhRCp1aegoMqRaCZg',
    color: '#05437C',
  },
  {
    id: 'france24',
    name: 'France 24 English',
    short: 'FRANCE 24',
    description: 'International news from Paris',
    youtubeChannelId: 'UCQfwfsi5VrQ8yKZ-UWmAEFg',
    color: '#0096D6',
  },
  {
    id: 'euronews',
    name: 'euronews',
    short: 'euronews.',
    description: 'European and world news',
    youtubeChannelId: 'UCSrZ3UV4jOidv8ppoVuvW9Q',
    color: '#00287A',
  },
  {
    id: 'bloomberg',
    name: 'Bloomberg Television',
    short: 'Bloomberg TV',
    description: 'Markets, business and finance',
    youtubeChannelId: 'UCIALMKvObZNtJ6AmdCLP7Lg',
    color: '#2800D7',
  },
  {
    id: 'nasa',
    name: 'NASA',
    short: 'NASA LIVE',
    description: 'Launches, spacewalks and views of Earth',
    youtubeChannelId: 'UCLA_DiR1FfKNvjuUpBHmylQ',
    color: '#0B3D91',
  },
];

/** Page the WebView loads. Embedding from an https origin avoids YouTube's "player configuration" error. */
export const LIVE_PLAYER_ORIGIN = 'https://newshammer.app';

export function livePlayerHtml(channel: LiveChannel): string {
  const src =
    `https://www.youtube.com/embed/live_stream?channel=${channel.youtubeChannelId}` +
    `&autoplay=1&playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(LIVE_PLAYER_ORIGIN)}`;
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style></head>
<body><iframe src="${src}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen
referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>`;
}

/** The channel's live page in the YouTube app or browser, for channels that block embedding. */
export function liveWatchUrl(channel: LiveChannel): string {
  return `https://www.youtube.com/channel/${channel.youtubeChannelId}/live`;
}
