// Videos and podcasts from news outlets: each YouTube channel's public upload feed and each show's
// podcast RSS. The app plays them itself (YouTube's player and the phone's audio player), so it
// never hosts or re-streams anything. Kept free of React Native imports so CI can check every feed.
import { XMLParser } from 'fast-xml-parser';

import { cleanText, parseDate } from './services/parse.ts';

export interface VideoChannel {
  id: string;
  name: string;
  youtubeChannelId: string;
  color: string;
}

export const VIDEO_CHANNELS: VideoChannel[] = [
  { id: 'cnn', name: 'CNN', youtubeChannelId: 'UCupvZG-5ko_eiXAupbDfxWw', color: '#CC0000' },
  { id: 'fox', name: 'Fox News', youtubeChannelId: 'UCXIJgqnII2ZOINSWNOGFThA', color: '#003366' },
  { id: 'abc', name: 'ABC News', youtubeChannelId: 'UCBi2mrWuNuyYy4gbM6fW3_A', color: '#003DA5' },
  { id: 'nbc', name: 'NBC News', youtubeChannelId: 'UCeY0bbntWzzVIaj2z3QigXg', color: '#5C2D91' },
  { id: 'cbs', name: 'CBS News', youtubeChannelId: 'UC8p1vwvWtl6T73JiExfWs1g', color: '#00539B' },
  { id: 'pbs', name: 'PBS NewsHour', youtubeChannelId: 'UC6ZFN9Tx6xh-skXCuRHCDpQ', color: '#2638C4' },
  { id: 'ap', name: 'Associated Press', youtubeChannelId: 'UC52X5wxOL_s5yw0dQk7NtgA', color: '#E4002B' },
  { id: 'reuters', name: 'Reuters', youtubeChannelId: 'UChqUTb7kYRX8-EiaN3XFrSQ', color: '#FF8000' },
  { id: 'sky', name: 'Sky News', youtubeChannelId: 'UCoMdktPbSTixAyNGwb-UYkQ', color: '#C8102E' },
  { id: 'aje', name: 'Al Jazeera English', youtubeChannelId: 'UCNye-wNBqNL5ZzHSJj3l8Bg', color: '#C78100' },
  { id: 'dw', name: 'DW News', youtubeChannelId: 'UCknLrEdhRCp1aegoMqRaCZg', color: '#05437C' },
  { id: 'bloomberg', name: 'Bloomberg', youtubeChannelId: 'UCIALMKvObZNtJ6AmdCLP7Lg', color: '#2800D7' },
  { id: 'espn', name: 'ESPN', youtubeChannelId: 'UCiWLfSweyRNmLpgEHekhoAg', color: '#D00000' },
  { id: 'nasa', name: 'NASA', youtubeChannelId: 'UCLA_DiR1FfKNvjuUpBHmylQ', color: '#0B3D91' },
];

export interface Podcast {
  id: string;
  name: string;
  /** Who makes it, shown under the title. */
  publisher: string;
  feed: string;
  color: string;
}

export const PODCASTS: Podcast[] = [
  { id: 'upfirst', name: 'Up First', publisher: 'NPR', feed: 'https://feeds.npr.org/510318/podcast.xml', color: '#3466B0' },
  { id: 'nprnews', name: 'NPR News Now', publisher: 'NPR', feed: 'https://feeds.npr.org/500005/podcast.xml', color: '#3466B0' },
  { id: 'thedaily', name: 'The Daily', publisher: 'The New York Times', feed: 'https://feeds.simplecast.com/54nAGcIl', color: '#121212' },
  { id: 'bbcglobal', name: 'Global News Podcast', publisher: 'BBC World Service', feed: 'https://podcasts.files.bbci.co.uk/p02nq0gn.rss', color: '#BB1919' },
  { id: 'whatsnews', name: "WSJ What's News", publisher: 'The Wall Street Journal', feed: 'https://video-api.wsj.com/podcast/rss/wsj/whats-news', color: '#0274B6' },
  { id: 'vergecast', name: 'The Vergecast', publisher: 'The Verge', feed: 'https://feeds.megaphone.fm/vergecast', color: '#5200FF' },
  { id: 'pbsnewshour', name: 'PBS News Hour', publisher: 'PBS', feed: 'https://www.pbs.org/newshour/feeds/rss/podcasts/show', color: '#2638C4' },
  { id: 'reutersworld', name: 'Reuters World News', publisher: 'Reuters', feed: 'https://feeds.megaphone.fm/reutersworldnews', color: '#FF8000' },
];

export interface Video {
  id: string;
  videoId: string;
  title: string;
  channel: string;
  channelId: string;
  thumbnail: string;
  publishedAt: number;
}

export interface Episode {
  id: string;
  title: string;
  show: string;
  showId: string;
  publisher: string;
  audioUrl: string;
  imageUrl?: string;
  publishedAt: number;
  /** Seconds; 0 when the feed doesn't say. */
  duration: number;
  summary: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  processEntities: true,
  htmlEntities: true,
  parseTagValue: false,
  trimValues: true,
});

type Node = Record<string, unknown>;
const list = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const text = (v: unknown): string =>
  typeof v === 'string' ? v : v && typeof v === 'object' ? String((v as Node)['#text'] ?? '') : '';
const attr = (v: unknown, name: string): string => (v && typeof v === 'object' ? String((v as Node)[`@_${name}`] ?? '') : '');

const TIMEOUT_MS = 12_000;

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** A channel's latest uploads from YouTube's public feed, without Shorts. */
export function parseYouTubeFeed(xml: string, channel: VideoChannel): Video[] {
  const feed = (parser.parse(xml) as Node).feed as Node | undefined;
  return list(feed?.entry as Node | Node[] | undefined).flatMap((e) => {
    const videoId = text(e['yt:videoId']);
    const href = attr(list(e.link as Node | Node[])[0], 'href');
    if (!videoId || /\/shorts\//.test(href)) return [];
    return [
      {
        id: `yt:${videoId}`,
        videoId,
        title: cleanText(text(e.title)),
        channel: channel.name,
        channelId: channel.id,
        // The 16:9 thumbnail; the feed's own is 4:3 with black bars.
        thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        publishedAt: parseDate(text(e.published)),
      },
    ];
  });
}

/** "1:02:03", "45:10", "2710" → seconds. */
export function parseDuration(v: string): number {
  if (!v) return 0;
  return v.split(':').reduce((total, part) => total * 60 + (Number(part) || 0), 0);
}

export function parsePodcastFeed(xml: string, podcast: Podcast): Episode[] {
  const channel = ((parser.parse(xml) as Node).rss as Node | undefined)?.channel as Node | undefined;
  const showImage = attr(channel?.['itunes:image'], 'href') || text((channel?.image as Node | undefined)?.url);
  return list(channel?.item as Node | Node[] | undefined).flatMap((item) => {
    const audioUrl = attr(item.enclosure, 'url');
    if (!audioUrl) return [];
    const title = cleanText(text(item.title));
    return [
      {
        id: `pod:${podcast.id}:${text(item.guid) || audioUrl}`,
        title,
        show: podcast.name,
        showId: podcast.id,
        publisher: podcast.publisher,
        audioUrl,
        imageUrl: attr(item['itunes:image'], 'href') || showImage || undefined,
        publishedAt: parseDate(text(item.pubDate)),
        duration: parseDuration(text(item['itunes:duration'])),
        summary: cleanText(text(item['itunes:summary']) || text(item.description)).slice(0, 280),
      },
    ];
  });
}

const CACHE_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, force: boolean, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

export function fetchChannelVideos(channel: VideoChannel, force = false): Promise<Video[]> {
  return cached(`yt:${channel.id}`, force, async () =>
    parseYouTubeFeed(
      await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel.youtubeChannelId}`),
      channel,
    ),
  );
}

export function fetchPodcastEpisodes(podcast: Podcast, force = false): Promise<Episode[]> {
  return cached(`pod:${podcast.id}`, force, async () => parsePodcastFeed(await fetchText(podcast.feed), podcast));
}

/** Newest videos across channels, at most `perChannel` from each so one channel can't fill the list. */
export async function latestVideos(force = false, perChannel = 3): Promise<Video[]> {
  const results = await Promise.allSettled(VIDEO_CHANNELS.map((c) => fetchChannelVideos(c, force)));
  return results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value.slice(0, perChannel) : []))
    .sort((a, b) => b.publishedAt - a.publishedAt);
}

/** The latest episode of each show, newest first. */
export async function latestEpisodes(force = false): Promise<Episode[]> {
  const results = await Promise.allSettled(PODCASTS.map((p) => fetchPodcastEpisodes(p, force)));
  return results
    .flatMap((r) => (r.status === 'fulfilled' && r.value[0] ? [r.value[0]] : []))
    .sort((a, b) => b.publishedAt - a.publishedAt);
}

export function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min`;
}
