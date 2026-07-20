/**
 * Activity-feed filtering and day-grouping, plus the food-total window sum.
 * Pure and unit-tested.
 */
import type { Entry, EntryType, FeedingEntry, FeedingMethod } from '../api/types';
import { dayHeader } from './dates';

const HOUR = 60 * 60 * 1000;

export type FeedFilter = 'all' | EntryType;

export interface DayGroup {
  header: string;
  entries: Entry[];
}

function timeOf(e: Entry): number {
  return new Date(e.time).getTime();
}

/** Filter by type (or 'all'), then group by calendar day, most recent first. */
export function filterAndGroup(
  entries: Entry[],
  filter: FeedFilter,
  now: number = Date.now(),
): DayGroup[] {
  const filtered = entries
    .filter((e) => filter === 'all' || e.type === filter)
    .sort((a, b) => timeOf(b) - timeOf(a));

  const groups: DayGroup[] = [];
  for (const e of filtered) {
    const header = dayHeader(e.time, now);
    const last = groups[groups.length - 1];
    if (last && last.header === header) last.entries.push(e);
    else groups.push({ header, entries: [e] });
  }
  return groups;
}

/** Sum of feeding amounts within the trailing window (hours). */
export function foodTotal(
  entries: Entry[],
  windowHours: number,
  now: number = Date.now(),
): number {
  const cutoff = now - windowHours * HOUR;
  return entries
    .filter(
      (e): e is FeedingEntry =>
        e.type === 'feeding' && e.amount != null && timeOf(e) >= cutoff,
    )
    .reduce((sum, e) => sum + (e.amount ?? 0), 0);
}

// --- Baselines captured at entry creation -----------------------------------

const DIRECT_BREAST: readonly FeedingMethod[] = ['leftBreast', 'rightBreast', 'bothBreasts'];

/**
 * Mean duration (minutes) of this child's feeds on one side over the trailing
 * `days`, or null when there's nothing to average.
 *
 * Left and right are averaged independently: a child who feeds 5 minutes on the
 * left and 15 on the right has two different baselines, and averaging them
 * together would flatter one and flatten the other.
 */
export function avgBreastDuration(
  entries: Entry[],
  side: 'leftBreast' | 'rightBreast',
  days = 7,
  now: number = Date.now(),
): number | null {
  const cutoff = now - days * 24 * HOUR;
  const matches = entries.filter(
    (e): e is FeedingEntry =>
      e.type === 'feeding' &&
      e.method === side &&
      e.durationMinutes != null &&
      timeOf(e) >= cutoff,
  );
  if (matches.length === 0) return null;
  const sum = matches.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
  return Math.round(sum / matches.length);
}

/**
 * The baseline duration to freeze onto a new direct-breast feed.
 *
 * "Both breasts" is the **sum** of the two sides' independent averages, not the
 * average of them — a both-sides feed is expected to run about as long as a left
 * plus a right. A side with no history contributes 0, but if neither side has
 * any history at all the result is null rather than 0, so the feed carries no
 * baseline instead of a meaningless one.
 */
export function defaultTimeForMethod(
  entries: Entry[],
  method: FeedingMethod,
  now: number = Date.now(),
): number | null {
  if (!DIRECT_BREAST.includes(method)) return null;
  if (method === 'bothBreasts') {
    const left = avgBreastDuration(entries, 'leftBreast', 7, now);
    const right = avgBreastDuration(entries, 'rightBreast', 7, now);
    if (left == null && right == null) return null;
    return (left ?? 0) + (right ?? 0);
  }
  return avgBreastDuration(entries, method as 'leftBreast' | 'rightBreast', 7, now);
}

// --- Feeding trend ----------------------------------------------------------

export interface FoodTrend {
  /** Total amount fed in the trailing 24h. */
  last24: number;
  /** Mean daily total over the 7 days *before* that window. */
  avgPerDay: number;
  /** True when today is at or above the baseline. */
  up: boolean;
  /** 0–100 bar fill: today as a share of the baseline, clamped. */
  percent: number;
}

/** Sum of feeding amounts in the window (startHoursAgo, endHoursAgo]. */
export function foodTotalRange(
  entries: Entry[],
  startHoursAgo: number,
  endHoursAgo: number,
  now: number = Date.now(),
): number {
  const from = now - startHoursAgo * HOUR;
  const to = now - endHoursAgo * HOUR;
  return entries
    .filter(
      (e): e is FeedingEntry =>
        e.type === 'feeding' && e.amount != null && timeOf(e) > from && timeOf(e) <= to,
    )
    .reduce((sum, e) => sum + (e.amount ?? 0), 0);
}

/**
 * Today's intake against the child's recent norm, for the "Last feeding" card.
 *
 * The baseline deliberately excludes the last 24h — comparing today against a
 * mean that already contains today would drag the bar toward 100% and hide the
 * very deviation the card exists to show.
 */
export function foodTrend(entries: Entry[], now: number = Date.now()): FoodTrend {
  const last24 = foodTotalRange(entries, 24, 0, now);
  const prior7Days = foodTotalRange(entries, 192, 24, now);
  const avgPerDay = Math.round(prior7Days / 7);
  // With no prior history the bar gauges today against itself, so it reads
  // full rather than empty. A fresh install has no norm to fall short of, and
  // an empty bar under "120ml today" looks like a bug.
  const base = avgPerDay > 0 ? avgPerDay : last24 || 1;
  // 4% floor so a token feed still reads as a bar rather than as nothing — but
  // nothing fed is nothing fed, and an empty bar is the honest picture of it.
  const percent =
    last24 === 0 ? 0 : Math.max(4, Math.min(100, Math.round((last24 / base) * 100)));
  return {
    last24,
    avgPerDay,
    up: avgPerDay === 0 ? last24 > 0 : last24 >= avgPerDay,
    percent,
  };
}

/** "120ml today vs 95ml/day (7d avg)" — the caption under the trend bar. */
export function foodTrendLabel(trend: FoodTrend): string {
  return `${trend.last24}ml today vs ${trend.avgPerDay}ml/day (7d avg)`;
}

// --- Feed gauge -------------------------------------------------------------

/** Fallback baselines when an entry predates the captured-baseline scheme. */
const FALLBACK_AMOUNT_MAX = { solid: 60, liquid: 240 };

/**
 * How full to draw an entry's gauge bar, or null when it should have none.
 *
 * Bottle and solid feeds gauge their amount against the baseline frozen onto
 * the entry (`defaultQtyAtEntry`); direct-breast feeds gauge their duration
 * against `defaultTimeAtEntry`. Entries written before those baselines existed
 * fall back to a fixed reference for amounts, but get no gauge for duration —
 * there's no sensible universal "normal" number of minutes at the breast.
 */
export function feedingGaugePercent(entry: FeedingEntry): number | null {
  if (entry.amount != null && entry.amount > 0) {
    const reference =
      entry.defaultQtyAtEntry ??
      (entry.kind === 'solidFood' ? FALLBACK_AMOUNT_MAX.solid : FALLBACK_AMOUNT_MAX.liquid);
    if (reference <= 0) return null;
    return clampGauge((entry.amount / reference) * 100);
  }

  if (
    DIRECT_BREAST.includes(entry.method) &&
    entry.durationMinutes != null &&
    entry.durationMinutes > 0 &&
    entry.defaultTimeAtEntry != null &&
    entry.defaultTimeAtEntry > 0
  ) {
    return clampGauge((entry.durationMinutes / entry.defaultTimeAtEntry) * 100);
  }

  return null;
}

/** 6% floor so a very small feed still reads as a bar rather than nothing. */
function clampGauge(pct: number): number {
  return Math.max(6, Math.min(100, Math.round(pct)));
}
