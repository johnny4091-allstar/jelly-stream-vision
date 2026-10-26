// Free live news channels. Each one is the broadcaster's own 24/7 live stream on YouTube. The app
// looks up the stream that's on air right now and plays it with YouTube's player, so it never hosts
// or re-streams video. Kept free of React Native imports so CI can run the lookup in Node.

export interface LiveChannel {
  id: string;
  name: string;
  /** Short wordmark shown on the tile. */
  short: string;
  description: string;
  /** YouTube @handle, used to find the stream that's live now. */
  handle: string;
  /** YouTube channel id, tried if the handle page doesn't resolve. */
  youtubeChannelId: string;
  color: string;
}

export const LIVE_CHANNELS: LiveChannel[] = [
  {
    id: 'abc',
    name: 'ABC News Live',
    short: 'abc NEWS LIVE',
    description: 'US and world news around the clock',
    handle: '@ABCNews',
    youtubeChannelId: 'UCBi2mrWuNuyYy4gbM6fW3_A',
    color: '#003DA5',
  },
  {
    id: 'nbc',
    name: 'NBC News NOW',
    short: 'NBC NEWS NOW',
    description: 'Breaking news and live coverage',
    handle: '@NBCNews',
    youtubeChannelId: 'UCeY0bbntWzzVIaj2z3QigXg',
    color: '#4B2E83',
  },
  {
    id: 'cbs',
    name: 'CBS News 24/7',
    short: 'CBS NEWS 24/7',
    description: 'Live reporting from CBS News',
    handle: '@CBSNews',
    youtubeChannelId: 'UC8p1vwvWtl6T73JiExfWs1g',
    color: '#111111',
  },
  {
    id: 'sky',
    name: 'Sky News',
    short: 'SKY NEWS',
    description: 'UK and international news',
    handle: '@SkyNews',
    youtubeChannelId: 'UCoMdktPbSTixAyNGwb-UYkQ',
    color: '#C8102E',
  },
  {
    id: 'aje',
    name: 'Al Jazeera English',
    short: 'AL JAZEERA',
    description: 'Global news from Doha',
    handle: '@aljazeeraenglish',
    youtubeChannelId: 'UCNye-wNBqNL5ZzHSJj3l8Bg',
    color: '#D98F00',
  },
  {
    id: 'dw',
    name: 'DW News',
    short: 'DW NEWS',
    description: "Germany's international broadcaster",
    handle: '@dwnews',
    youtubeChannelId: 'UCknLrEdhRCp1aegoMqRaCZg',
    color: '#05437C',
  },
  {
    id: 'france24',
    name: 'France 24 English',
    short: 'FRANCE 24',
    description: 'International news from Paris',
    handle: '@France24_en',
    youtubeChannelId: 'UCQfwfsi5VrQ8yKZ-UWmAEFg',
    color: '#0096D6',
  },
  {
    id: 'euronews',
    name: 'euronews',
    short: 'euronews.',
    description: 'European and world news',
    handle: '@euronews',
    youtubeChannelId: 'UCSrZ3UV4jOidv8ppoVuvW9Q',
    color: '#00287A',
  },
  {
    id: 'bloomberg',
    name: 'Bloomberg Television',
    short: 'Bloomberg TV',
    description: 'Markets, business and finance',
    handle: '@markets',
    youtubeChannelId: 'UCIALMKvObZNtJ6AmdCLP7Lg',
    color: '#2800D7',
  },
  {
    id: 'nasa',
    name: 'NASA',
    short: 'NASA LIVE',
    description: 'Launches, spacewalks and views of Earth',
    handle: '@NASA',
    youtubeChannelId: 'UCLA_DiR1FfKNvjuUpBHmylQ',
    color: '#0B3D91',
  },
];

export type LiveResult =
  | { status: 'live'; videoId: string; embeddable: boolean }
  | { status: 'offline' }
  | { status: 'error' };

const HEADERS = {
  // A desktop browser gets the full page with the canonical watch link; the cookies skip the EU
  // consent interstitial.
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Cookie: 'SOCS=CAI; CONSENT=YES+1',
};

const LIVE_PATTERNS: [string, RegExp][] = [
  // Server-rendered link tags (older pages, and some regions).
  ['canonical', /<link rel="canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/],
  ['og:url', /<meta property="og:url" content="https:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})"/],
  ['shortlink', /<link rel="shortlinkUrl" href="https:\/\/youtu\.be\/([\w-]{11})"/],
  // The player data embedded as JSON (pages whose link tags are filled in by JavaScript).
  ['videoDetails', /"videoDetails":\s*\{\s*"videoId":\s*"([\w-]{11})"/],
  ['currentVideoEndpoint', /"currentVideoEndpoint":\{[^{}]*?"watchEndpoint":\{"videoId":"([\w-]{11})"/],
];

/** Which patterns matched, for the CI diagnostics. */
export function liveMatches(html: string): string[] {
  return LIVE_PATTERNS.filter(([, re]) => re.test(html)).map(([name]) => name);
}

/** The video id of the stream a /live page points at, or null when the channel isn't live. */
export function parseLiveVideoId(html: string): string | null {
  // A /live page for a channel that isn't streaming is the channel page: no player data at all.
  const isWatchPage = html.includes('"videoDetails"') || html.includes('watch?v=');
  if (!isWatchPage) return null;
  for (const [, re] of LIVE_PATTERNS) {
    const id = re.exec(html)?.[1];
    if (id) return id;
  }
  return null;
}

/** Set by the CI check to see what YouTube actually returned. */
export const liveDebug: { log?: (msg: string) => void } = {};

async function liveVideoIdFrom(url: string): Promise<string | null> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    liveDebug.log?.(`${url} -> HTTP ${res.status}`);
    return null;
  }
  const html = await res.text();
  const id = parseLiveVideoId(html);
  if (!id && liveDebug.log) {
    const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
    const live = /"isLive(?:Now|Content)?":true/.exec(html)?.[0] ?? 'no isLive flag';
    const ids = [...new Set(html.match(/"videoId":"[\w-]{11}"/g) ?? [])].slice(0, 3).join(' ');
    liveDebug.log(`${url} (${html.length} bytes) title="${title}" ${live} ids=[${ids}]`);
  }
  return id;
}

/** YouTube's oEmbed answers 401/403 for videos whose owner turned off playback in other apps. */
async function isEmbeddable(videoId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
    );
    return res.ok;
  } catch {
    return true;
  }
}

const cache = new Map<string, { at: number; result: LiveResult }>();
const CACHE_MS = 10 * 60 * 1000;

/** Finds what a channel is streaming live right now. */
export async function resolveLive(channel: LiveChannel, force = false): Promise<LiveResult> {
  const hit = cache.get(channel.id);
  if (!force && hit && Date.now() - hit.at < CACHE_MS && hit.result.status !== 'error') return hit.result;
  let result: LiveResult;
  try {
    const videoId =
      (await liveVideoIdFrom(`https://www.youtube.com/${channel.handle}/live`)) ??
      (await liveVideoIdFrom(`https://www.youtube.com/channel/${channel.youtubeChannelId}/live`));
    result = videoId ? { status: 'live', videoId, embeddable: await isEmbeddable(videoId) } : { status: 'offline' };
  } catch {
    result = { status: 'error' };
  }
  cache.set(channel.id, { at: Date.now(), result });
  return result;
}

/** Page the WebView loads. Embedding from an https origin avoids YouTube's "player configuration" error. */
export const LIVE_PLAYER_ORIGIN = 'https://newshammer.app';

/**
 * YouTube player for one video, using the IFrame API so playback errors (for example the owner
 * blocking other apps) are posted back to the app as `error:<code>`.
 */
export function livePlayerHtml(videoId: string): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#p{width:100%;height:100%}</style></head>
<body><div id="p"></div><script>
function post(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(m)}
var tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';document.head.appendChild(tag);
function onYouTubeIframeAPIReady(){new YT.Player('p',{videoId:${JSON.stringify(videoId)},host:'https://www.youtube.com',
playerVars:{autoplay:1,playsinline:1,rel:0,modestbranding:1,origin:${JSON.stringify(LIVE_PLAYER_ORIGIN)}},
events:{onReady:function(e){e.target.playVideo();post('ready')},onError:function(e){post('error:'+e.data)}}})}
</script></body></html>`;
}

/** YouTube's mobile watch page, used in the in-app reader when a stream can't be embedded. */
export function liveWatchUrl(videoId: string): string {
  return `https://m.youtube.com/watch?v=${videoId}`;
}

/** The channel's live page on YouTube's mobile site; YouTube forwards it to the current stream. */
export function liveChannelUrl(channel: LiveChannel): string {
  return `https://m.youtube.com/${channel.handle}/live`;
}
