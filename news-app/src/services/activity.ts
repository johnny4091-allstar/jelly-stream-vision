// Reading streak, counts and badges. Pure (no React Native imports) so CI can check it in Node.

export interface Activity {
  /** Days a story was opened, as local YYYY-MM-DD, oldest first, each once. */
  days: string[];
  /** Stories opened. */
  read: number;
  /** Full coverage screens opened. */
  coverage: number;
  /** Morning briefings listened to or read. */
  briefings: number;
  /** Opened a story before 7 AM. */
  earlyBird: boolean;
  /** Opened a story after 11 PM. */
  nightOwl: boolean;
}

export const EMPTY_ACTIVITY: Activity = { days: [], read: 0, coverage: 0, briefings: 0, earlyBird: false, nightOwl: false };

const MAX_DAYS = 400;

/** Local calendar day, e.g. "2026-11-08". */
export function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function addDay(days: string[], key: string): string[] {
  if (days.includes(key)) return days;
  return [...days, key].sort().slice(-MAX_DAYS);
}

export type ActivityEvent = 'read' | 'coverage' | 'briefing';

/** The activity after one thing happened at `now`. */
export function record(a: Activity, event: ActivityEvent, now = new Date()): Activity {
  const days = addDay(a.days, dayKey(now));
  if (event === 'coverage') return { ...a, days, coverage: a.coverage + 1 };
  if (event === 'briefing') return { ...a, days, briefings: a.briefings + 1 };
  const h = now.getHours();
  return { ...a, days, read: a.read + 1, earlyBird: a.earlyBird || (h >= 4 && h < 7), nightOwl: a.nightOwl || h >= 23 || h < 3 };
}

/**
 * Days in a row with reading, ending today, or yesterday if nothing has been read yet today (the
 * streak isn't lost until a whole day passes).
 */
export function streak(days: string[], now = new Date()): number {
  const set = new Set(days);
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!set.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let n = 0;
  while (set.has(dayKey(cursor))) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

/** The longest run of days in a row ever. */
export function bestStreak(days: string[]): number {
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of [...days].sort()) {
    const [y, m, d] = key.split('-').map(Number) as [number, number, number];
    const date = new Date(y, m - 1, d);
    const next = prev ? new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1) : null;
    run = next && dayKey(next) === key ? run + 1 : 1;
    best = Math.max(best, run);
    prev = date;
  }
  return best;
}

/** Whether each of the last seven days (oldest first, today last) had reading. */
export function lastWeek(days: string[], now = new Date()): { key: string; letter: string; done: boolean; today: boolean }[] {
  const set = new Set(days);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    return { key: dayKey(date), letter: 'SMTWTFS'[date.getDay()]!, done: set.has(dayKey(date)), today: i === 6 };
  });
}

/** Two phones' activity combined (account sync): every day from both, the higher counts. */
export function mergeActivity(a: Activity, b: Partial<Activity> | undefined): Activity {
  if (!b) return a;
  return {
    days: [...new Set([...a.days, ...(b.days ?? [])])].sort().slice(-MAX_DAYS),
    read: Math.max(a.read, b.read ?? 0),
    coverage: Math.max(a.coverage, b.coverage ?? 0),
    briefings: Math.max(a.briefings, b.briefings ?? 0),
    earlyBird: a.earlyBird || !!b.earlyBird,
    nightOwl: a.nightOwl || !!b.nightOwl,
  };
}

export interface Badge {
  id: string;
  name: string;
  /** How to earn it. */
  how: string;
  icon: string;
  color: string;
  earned: boolean;
  /** 0–1 toward earning it. */
  progress: number;
}

export function badges(a: Activity): Badge[] {
  const best = bestStreak(a.days);
  const part = (have: number, need: number) => Math.min(1, have / need);
  return [
    { id: 'first', name: 'First story', how: 'Open your first story', icon: 'newspaper', color: '#5CC8FF', earned: a.read >= 1, progress: part(a.read, 1) },
    { id: 'week', name: 'Week streak', how: 'Read 7 days in a row', icon: 'flame', color: '#FF5A1F', earned: best >= 7, progress: part(best, 7) },
    { id: 'early', name: 'Early bird', how: 'Read a story before 7 AM', icon: 'sunny', color: '#FFC53D', earned: a.earlyBird, progress: a.earlyBird ? 1 : 0 },
    { id: 'owl', name: 'Night owl', how: 'Read a story after 11 PM', icon: 'moon', color: '#A78BFA', earned: a.nightOwl, progress: a.nightOwl ? 1 : 0 },
    { id: 'coverage', name: 'Every side', how: 'Open Full coverage 5 times', icon: 'layers', color: '#22D3EE', earned: a.coverage >= 5, progress: part(a.coverage, 5) },
    { id: 'briefing', name: 'Briefed', how: 'Use the morning briefing 5 times', icon: 'headset', color: '#F472B6', earned: a.briefings >= 5, progress: part(a.briefings, 5) },
    { id: 'bookworm', name: 'Bookworm', how: 'Read 100 stories', icon: 'library', color: '#3FD07A', earned: a.read >= 100, progress: part(a.read, 100) },
    { id: 'month', name: 'Month streak', how: 'Read 30 days in a row', icon: 'trophy', color: '#FB923C', earned: best >= 30, progress: part(best, 30) },
  ];
}
