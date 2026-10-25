/** "Just now", "52 minutes ago", "1 hour ago", "Yesterday", or a short date. */
export function timeAgo(ms: number, now = Date.now()): string {
  if (!ms) return '';
  const diff = Math.max(0, now - ms);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (hours < 48) return 'Yesterday';
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

/** Morning / Afternoon / Evening, for the briefing card. */
export function partOfDay(date = new Date()): 'Morning' | 'Afternoon' | 'Evening' {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'Morning';
  if (h >= 12 && h < 17) return 'Afternoon';
  return 'Evening';
}
