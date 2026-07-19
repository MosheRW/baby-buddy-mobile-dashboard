/**
 * Dashboard derivations from the entry list. The medication and food-total math
 * lives in the tested `src/lib` modules; this file adds the child-scoped
 * "last X" lookups the child card needs.
 */
import type { Entry, DiaperEntry, FeedingEntry } from '../../api/types';

export { neededMeds, eligibleMeds, type MedStatus } from '../../lib/medication';
export { foodTotal } from '../../lib/feed';

export function entriesForChild(entries: Entry[], childId: string): Entry[] {
  return entries
    .filter((e) => e.childId === childId)
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

/** Most recent diaper entry with pee (or poo) true. */
export function lastDiaper(entries: Entry[], which: 'pee' | 'poo'): DiaperEntry | undefined {
  return entries.find((e): e is DiaperEntry => e.type === 'diaper' && e[which]);
}

export function lastFeeding(entries: Entry[]): FeedingEntry | undefined {
  return entries.find((e): e is FeedingEntry => e.type === 'feeding');
}
