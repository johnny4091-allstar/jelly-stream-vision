import AsyncStorage from '@react-native-async-storage/async-storage';

import { SOURCES } from '../sources';
import type { Source, SourceId, Story, Topic } from '../types';
import { parseFeed } from './parse';

export const CACHE_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_PER_FEED = 30;
// v2: parser fixes (ESPN images, "null" summaries) shouldn't wait for old cached feeds to expire.
const CACHE_PREFIX = 'feedcache:v2:';

interface CacheEntry {
  fetchedAt: number;
  stories: Story[];
}

// Memory first so tab switches are instant; AsyncStorage so a cold start within the TTL is too.
const memory = new Map<string, CacheEntry>();

async function readCache(url: string): Promise<CacheEntry | undefined> {
  const hit = memory.get(url);
  if (hit) return hit;
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + url);
    if (!raw) return undefined;
    const entry = JSON.parse(raw) as CacheEntry;
    memory.set(url, entry);
    return entry;
  } catch {
    return undefined;
  }
}

async function writeCache(url: string, entry: CacheEntry): Promise<void> {
  memory.set(url, entry);
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + url, JSON.stringify(entry));
  } catch {
    // Cache is best-effort.
  }
}

/** Every story loaded so far this session, from any topic or outlet (for Full coverage and search). */
export function cachedStories(): Story[] {
  const seen = new Set<string>();
  const all: Story[] = [];
  for (const entry of memory.values())
    for (const s of entry.stories) {
      if (seen.has(s.link)) continue;
      seen.add(s.link);
      all.push(s);
    }
  return all;
}

export async function clearFeedCache(): Promise<void> {
  memory.clear();
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(CACHE_PREFIX)));
}

// The News tab asks for every topic at once (well over 100 feeds). Fetch a few at a time so the
// phone's connection isn't swamped; the rest wait their turn, first asked first served.
const MAX_CONCURRENT_FETCHES = 6;
let active = 0;
const waiting: (() => void)[] = [];

async function withFetchSlot<T>(task: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT_FETCHES) await new Promise<void>((resolve) => waiting.push(resolve));
  active++;
  try {
    return await task();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

function fetchText(url: string): Promise<string> {
  return withFetchSlot(() => fetchTextNow(url));
}

async function fetchTextNow(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function loadFeed(source: Source, url: string, force: boolean): Promise<Story[]> {
  const cached = await readCache(url);
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.stories;
  try {
    const stories = parseFeed(await fetchText(url), source).slice(0, MAX_PER_FEED);
    if (stories.length === 0) throw new Error('empty feed');
    await writeCache(url, { fetchedAt: Date.now(), stories });
    return stories;
  } catch (err) {
    // Offline or the outlet is down: stale stories beat none.
    if (cached) return cached.stories;
    throw err;
  }
}

export interface NewsResult {
  stories: Story[];
  failed: SourceId[];
}

/**
 * Loads one topic from every enabled source in parallel. A feed that fails is skipped and
 * reported in `failed`; it never blocks the others.
 */
export async function loadTopic(topic: Topic, enabled: SourceId[], force = false): Promise<NewsResult> {
  const jobs = SOURCES.filter((s) => enabled.includes(s.id) && s.feeds[topic]).map((s) => ({
    source: s,
    promise: loadFeed(s, s.feeds[topic]!, force),
  }));
  const results = await Promise.allSettled(jobs.map((j) => j.promise));

  const seen = new Set<string>();
  const stories: Story[] = [];
  const failed: SourceId[] = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      failed.push(jobs[i]!.source.id);
      return;
    }
    for (const story of r.value) {
      const key = story.link.replace(/[?#].*$/, '');
      if (seen.has(key)) continue;
      seen.add(key);
      stories.push(story);
    }
  });
  stories.sort((a, b) => b.publishedAt - a.publishedAt);
  return { stories, failed };
}

/** The Today picks: the newest stories, at most two from any one outlet so it isn't one-note. */
export function pickTopStories(stories: Story[], count = 5): Story[] {
  const perSource = new Map<SourceId, number>();
  const picks: Story[] = [];
  for (const s of stories) {
    const n = perSource.get(s.sourceId) ?? 0;
    if (n >= 2) continue;
    perSource.set(s.sourceId, n + 1);
    picks.push(s);
    if (picks.length === count) return picks;
  }
  // Not enough variety (e.g. one source enabled): fill with whatever is newest.
  for (const s of stories) {
    if (picks.length === count) break;
    if (!picks.includes(s)) picks.push(s);
  }
  return picks;
}
