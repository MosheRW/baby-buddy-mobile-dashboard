/**
 * "Active day" accounting for the day-averaged statistics.
 *
 * A day is *active* when at least one entry of any type was logged in it. The
 * food-trend baseline and the feed-card gauges divide a total by a number of
 * days; when the user opts to exclude inactive days, that divisor becomes the
 * count of active days instead of the raw calendar span, so a stretch with no
 * logging stops dragging the average down.
 *
 * Days are counted as trailing 24h buckets rather than local calendar dates.
 * This keeps the divisor exactly aligned with the windows the food math already
 * uses (`foodTotalRange`'s hour offsets) and sidesteps the off-by-one a
 * non-midnight-aligned 7×24h span would otherwise create — a 7-day window can
 * touch 8 calendar dates. Pure and unit-tested.
 */
import type { Entry } from '../api/types';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function timeOf(e: Entry): number {
  return new Date(e.time).getTime();
}

/**
 * How many of the `windowDays` trailing 24h buckets hold at least one entry.
 *
 * Bucket `k` (0-based) covers the age range [k, k+1) days before `now`; the
 * window is buckets `[offsetDays, offsetDays + windowDays)`. The food-trend
 * baseline uses `offsetDays = 1` (skip today) and `windowDays = 7`; the
 * feed-card norm uses `offsetDays = 0` (include today).
 */
export function activeDayCount(
  entries: Entry[],
  now: number,
  windowDays: number,
  offsetDays = 0,
): number {
  const active = new Set<number>();
  for (const e of entries) {
    const ageMs = now - timeOf(e);
    if (ageMs < 0) continue; // future-dated entry, outside any trailing window
    const bucket = Math.floor(ageMs / DAY);
    if (bucket >= offsetDays && bucket < offsetDays + windowDays) active.add(bucket);
  }
  return active.size;
}

/** Days in the food-trend baseline window (buckets 1..7) that had no entry. */
export function inactiveBaselineDays(entries: Entry[], now: number = Date.now()): number {
  return Math.max(0, 7 - activeDayCount(entries, now, 7, 1));
}

/**
 * Whether the food-trend baseline is being diluted by inactive days — the
 * trigger for the one-time dashboard prompt.
 *
 * True only when there is *some* baseline history (so a brand-new account with
 * an empty window stays quiet) and at least one of those days is inactive.
 */
export function hasInactiveBaselineDays(entries: Entry[], now: number = Date.now()): boolean {
  const active = activeDayCount(entries, now, 7, 1);
  return active > 0 && active < 7;
}
