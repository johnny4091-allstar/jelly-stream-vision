// Unit checks for the streak, badges and Full coverage logic. Fails the build on a wrong answer.
import assert from 'node:assert/strict';

import { EMPTY_ACTIVITY, badges, bestStreak, lastWeek, mergeActivity, record, streak } from '../src/services/activity.ts';
import { biggestStories, findCoverage, keywords, sameStory } from '../src/services/coverage.ts';
import { hotspots, placesIn, project } from '../src/services/pulse.ts';

let a = EMPTY_ACTIVITY;
for (const t of ['2026-11-01T08:00', '2026-11-02T06:30', '2026-11-03T23:30', '2026-11-05T12:00', '2026-11-06T12:00', '2026-11-07T12:00'])
  a = record(a, 'read', new Date(t));
assert.equal(a.read, 6);
assert.equal(streak(a.days, new Date('2026-11-07T20:00')), 3, 'streak counts today');
assert.equal(streak(a.days, new Date('2026-11-08T09:00')), 3, 'streak survives until a whole day passes');
assert.equal(streak(a.days, new Date('2026-11-09T09:00')), 0, 'streak ends after a missed day');
assert.equal(bestStreak(a.days), 3);
assert.equal(lastWeek(a.days, new Date('2026-11-08T09:00')).filter((d) => d.done).length, 5);
assert.deepEqual(badges(a).filter((b) => b.earned).map((b) => b.id), ['first', 'early', 'owl']);
const merged = mergeActivity(a, { days: ['2026-11-04'], read: 50 });
assert.equal(merged.read, 50);
assert.equal(bestStreak(merged.days), 7, 'merging another phone fills the gap');
assert.ok(badges(merged).find((b) => b.id === 'week')?.earned);

const s = (title, sourceId, i) => ({ id: `l${i}`, title, link: `l${i}`, summary: '', publishedAt: i, sourceId, sourceName: sourceId });
const pool = [
  s('Storm moves up East Coast as millions brace for heavy rain', 'bbc', 1),
  s('East Coast storm: millions brace for heavy rain and flooding', 'ap', 2),
  s('Heavy rain storm hits East Coast', 'cnn', 3),
  s('Fed holds interest rates steady', 'cnbc', 4),
  s('Lakers beat Celtics in overtime', 'espn', 5),
];
const cov = findCoverage(pool[0], pool);
assert.equal(cov.outlets, 3);
assert.ok(!cov.stories.some((x) => x.sourceId === 'espn' || x.sourceId === 'cnbc'));
assert.ok(sameStory(keywords('Fed holds interest rates steady'), keywords('Federal Reserve holds rates steady again')));
assert.ok(!sameStory(keywords('Lakers beat Celtics in overtime'), keywords('Fed holds interest rates steady')));
const big = biggestStories(pool, 0, 3);
assert.equal(big[0].outlets, 3, 'the storm is the biggest story');
assert.equal(big.length, 3);

assert.deepEqual(placesIn({ title: 'Zelensky meets Macron in Paris', summary: '' }).map((p) => p.id).sort(), ['france', 'ukraine']);
assert.equal(placesIn({ title: 'Ukulele festival opens', summary: '' }).length, 0, 'whole words only');
const now = Date.parse('2026-11-08T12:00:00Z');
const spots = hotspots(
  [
    { ...s('Kyiv hit by drones', 'bbc', now - 3600e3), link: 'a' },
    { ...s('Ukraine talks resume', 'ap', now - 7200e3), link: 'b' },
    { ...s('Tokyo markets rise', 'cnbc', now - 3600e3), link: 'c' },
    { ...s('Old story about Japan', 'cnn', now - 48 * 3600e3), link: 'd' },
  ],
  now,
);
assert.equal(spots[0].place.id, 'ukraine');
assert.equal(spots[0].stories.length, 2);
assert.equal(spots.find((h) => h.place.id === 'japan').stories.length, 1, 'stories older than a day are left out');
assert.ok(project(0, 0, 0, 0).visible && !project(0, 180, 0, 0).visible, 'the far side is hidden');

console.log('Streaks, badges, Full coverage, biggest stories and Pulse: all checks passed.');
