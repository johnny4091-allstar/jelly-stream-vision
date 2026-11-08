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

/**
 * The day's biggest stories: each covered by the most outlets, one per story (an outlet's other
 * versions of it are left out), most outlets first, then the newest single-outlet stories.
 */
export function biggestStories(pool: Story[], since: number, count = 5): Coverage[] {
  // Newest few hundred only: every story is compared with every other.
  const seen = new Set<string>();
  const recent = pool
    .filter((s) => s.publishedAt >= since && !seen.has(s.link) && (seen.add(s.link), true))
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, 500);
  const words = recent.map((s) => keywords(s.title));
  const clusters = recent.map((story, i) => {
    const bySource = new Map<string, Story>([[story.sourceId, story]]);
    words.forEach((w, j) => {
      const other = recent[j]!;
      if (j !== i && !bySource.has(other.sourceId) && sameStory(words[i]!, w)) bySource.set(other.sourceId, other);
    });
    const stories = [...bySource.values()].sort((x, y) => y.publishedAt - x.publishedAt);
    return { stories, outlets: stories.length };
  });
  clusters.sort((a, b) => b.outlets - a.outlets || (b.stories[0]?.publishedAt ?? 0) - (a.stories[0]?.publishedAt ?? 0));
  const used = new Set<string>();
  const picks: Coverage[] = [];
  for (const c of clusters) {
    if (c.stories.some((s) => used.has(s.link))) continue;
    c.stories.forEach((s) => used.add(s.link));
    picks.push(c);
    if (picks.length === count) break;
  }
  return picks;
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
