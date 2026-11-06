// "Full coverage": the same story as reported by other outlets, found by comparing headlines.
// Pure (no React Native imports) so CI can check it in Node.

import type { Story } from '../types';

const STOPWORDS = new Set(
  (
    'the a an and or but of to in on at for from by with as is are was were be been being it its this that these those ' +
    'after before over under into out up down off about than then new says said say will would could can may might ' +
    'has have had not no his her their they them he she we you your our who what when where why how all more most ' +
    'just amid vs via live update updates latest watch video photos report reports news breaking first last year ' +
    'week day today two three one'
  ).split(' '),
);

/** The words in a headline that say what it's about. */
export function keywords(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .replace(/[’']s\b/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return new Set(words);
}

/** True when two headlines are about the same story. */
export function sameStory(a: Set<string>, b: Set<string>): boolean {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  const smaller = Math.min(a.size, b.size);
  return shared >= 3 || (shared >= 2 && smaller > 0 && shared / smaller >= 0.5);
}

export interface Coverage {
  /** Every story about it, the given one included, newest first, at most one per outlet. */
  stories: Story[];
  /** How many different outlets covered it. */
  outlets: number;
}

/** The given story plus other outlets' stories about the same thing, from `pool`. */
export function findCoverage(story: Story, pool: Story[]): Coverage {
  const target = keywords(story.title);
  const bySource = new Map<string, Story>([[story.sourceId, story]]);
  const seen = new Set([story.link]);
  for (const s of pool) {
    if (seen.has(s.link)) continue;
    seen.add(s.link);
    if (s.sourceId === story.sourceId || bySource.has(s.sourceId)) continue;
    if (sameStory(target, keywords(s.title))) bySource.set(s.sourceId, s);
  }
  const stories = [...bySource.values()].sort((a, b) => b.publishedAt - a.publishedAt);
  return { stories, outlets: stories.length };
}
