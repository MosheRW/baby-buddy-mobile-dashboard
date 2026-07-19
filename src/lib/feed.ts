/**
 * Activity-feed filtering and day-grouping, plus the food-total window sum.
 * Pure and unit-tested.
 */
import type { Entry, EntryType, FeedingEntry } from '../api/types';
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
