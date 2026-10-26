import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import type { Story } from '../types';

// For stories whose feed has no picture, use the article's own share image (og:image), the same
// one a messaging app shows for a link preview. Only that meta tag is read, never the article text.

const KEY_PREFIX = 'previewimg:v1:';
const TIMEOUT_MS = 8000;
const MAX_PARALLEL = 3;

const memory = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
const queue: (() => void)[] = [];
let running = 0;

function schedule<T>(job: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      running++;
      job()
        .then(resolve, reject)
        .finally(() => {
          running--;
          queue.shift()?.();
        });
    };
    if (running < MAX_PARALLEL) run();
    else queue.push(run);
  });
}

export function extractPreviewImage(html: string, pageUrl: string): string {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
  ];
  for (const re of patterns) {
    const raw = re.exec(html)?.[1];
    if (!raw) continue;
    try {
      const url = new URL(raw.replace(/&amp;/g, '&'), pageUrl).toString();
      if (/^https?:\/\//.test(url)) return url.replace(/^http:\/\//, 'https://');
    } catch {
      // Ignore malformed URLs.
    }
  }
  return '';
}

async function fetchPreviewImage(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'text/html' } });
    if (!res.ok) return '';
    // The meta tags are in <head>; a long page doesn't need to be searched past it.
    const html = (await res.text()).slice(0, 400_000);
    return extractPreviewImage(html, res.url || url);
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

/** The share image for a story's page, or '' if it has none. Cached on the phone. */
export async function previewImageFor(link: string): Promise<string> {
  const hit = memory.get(link);
  if (hit !== undefined) return hit;
  const pending = inflight.get(link);
  if (pending) return pending;
  const job = (async () => {
    try {
      const stored = await AsyncStorage.getItem(KEY_PREFIX + link);
      if (stored !== null) return stored;
    } catch {
      // Fall through to the network.
    }
    const found = await schedule(() => fetchPreviewImage(link));
    AsyncStorage.setItem(KEY_PREFIX + link, found).catch(() => {});
    return found;
  })();
  inflight.set(link, job);
  const result = await job.finally(() => inflight.delete(link));
  memory.set(link, result);
  return result;
}

/** A story's picture: the feed's image, else the page's share image once it has loaded. */
export function useStoryImage(story: Story): string | undefined {
  const [fallback, setFallback] = useState<string | undefined>(() => memory.get(story.link) || undefined);
  useEffect(() => {
    // Google News links (AP) point at a redirect page whose share image is Google's logo.
    if (story.imageUrl || /news\.google\.com/.test(story.link)) return;
    let cancelled = false;
    previewImageFor(story.link).then((img) => {
      if (!cancelled && img) setFallback(img);
    });
    return () => {
      cancelled = true;
    };
  }, [story.imageUrl, story.link]);
  return story.imageUrl ?? fallback;
}
