/**
 * Date/time helpers for display. Kept pure so they can be unit-tested in Phase 3.
 * Display copy is looked up from i18n; the numeric math stays here.
 */
import i18n from '../i18n';
import { formatClock, formatSpan, getActiveTimeFormat, type TimeFormat } from './timeFormat';

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

/** Duration between two ISO times (or from a start to now), in the active format. */
export function durationLabel(
  startIso: string,
  endIso?: string,
  now: number = Date.now(),
  format: TimeFormat = getActiveTimeFormat(),
): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : now;
  return formatSpan(Math.max(0, end - start), format);
}

/** Live-timer elapsed since a start time — mm:ss (text) or h:mm:ss (digital). */
export function elapsedClock(
  startIso: string,
  now: number = Date.now(),
  format: TimeFormat = getActiveTimeFormat(),
): string {
  return formatClock(Math.max(0, now - new Date(startIso).getTime()), format);
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
