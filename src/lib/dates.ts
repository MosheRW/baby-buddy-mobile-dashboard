/**
 * Date/time helpers for display. Kept pure so they can be unit-tested in Phase 3.
 */

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Compact "time since" label, e.g. "45m ago", "3h ago", "2d ago", "now". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  if (diff < MIN) return 'now';
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m ago`;
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    const m = Math.floor((diff % HOUR) / MIN);
    return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
  }
  return `${Math.floor(diff / DAY)}d ago`;
}

/** "Xh Ym" duration between two ISO times (or from a start to now). */
export function durationLabel(startIso: string, endIso?: string, now: number = Date.now()): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : now;
  const diff = Math.max(0, end - start);
  const h = Math.floor(diff / HOUR);
  const m = Math.floor((diff % HOUR) / MIN);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** mm:ss elapsed since a start time — for live timer displays. */
export function elapsedClock(startIso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(startIso).getTime());
  const totalSec = Math.floor(diff / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

/** Greeting based on the hour of day. */
export function greeting(now: number = Date.now()): string {
  const h = new Date(now).getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** "Sunday, July 19" style long date. */
export function longDate(now: number = Date.now()): string {
  return new Date(now).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Day-group header for the activity feed: "Today" / "Yesterday" / short date
 * like "Jul 12".
 */
export function dayHeader(iso: string, now: number = Date.now()): string {
  const d = new Date(iso);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const t = d.getTime();
  if (t >= startOfToday) return 'Today';
  if (t >= startOfToday - DAY) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
