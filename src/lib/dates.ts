/**
 * Date/time helpers for display. Kept pure so they can be unit-tested in Phase 3.
 * Display copy is looked up from i18n; the numeric math stays here.
 */
import i18n from '../i18n';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Compact "time since" label, e.g. "45m ago", "3h ago", "2d ago", "now". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  if (diff < MIN) return i18n.t('dates.now');
  if (diff < HOUR) return i18n.t('dates.minutesAgo', { m: Math.floor(diff / MIN) });
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    const m = Math.floor((diff % HOUR) / MIN);
    return m > 0 ? i18n.t('dates.hoursMinutesAgo', { h, m }) : i18n.t('dates.hoursAgo', { h });
  }
  return i18n.t('dates.daysAgo', { d: Math.floor(diff / DAY) });
}

/** "Xh Ym" duration between two ISO times (or from a start to now). */
export function durationLabel(startIso: string, endIso?: string, now: number = Date.now()): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : now;
  const diff = Math.max(0, end - start);
  const h = Math.floor(diff / HOUR);
  const m = Math.floor((diff % HOUR) / MIN);
  if (h > 0) return i18n.t('duration.hoursMinutes', { h, m });
  return i18n.t('duration.minutes', { m });
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
  if (h < 12) return i18n.t('dates.greeting.morning');
  if (h < 18) return i18n.t('dates.greeting.afternoon');
  return i18n.t('dates.greeting.evening');
}

/** "Sunday, July 19" style long date, in the active language's locale. */
export function longDate(now: number = Date.now()): string {
  return new Date(now).toLocaleDateString(i18n.language || undefined, {
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
  if (t >= startOfToday) return i18n.t('dates.today');
  if (t >= startOfToday - DAY) return i18n.t('dates.yesterday');
  return d.toLocaleDateString(i18n.language || undefined, { month: 'short', day: 'numeric' });
}
