import { activeDayCount, hasInactiveBaselineDays, inactiveBaselineDays } from '../activeDays';
import type { DiaperEntry, Entry, FeedingEntry } from '../../api/types';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date(2026, 6, 19, 12, 0, 0).getTime();

const iso = (ms: number) => new Date(ms).toISOString();

function diaper(id: string, time: number): DiaperEntry {
  return {
    id,
    childId: 'c1',
    type: 'diaper',
    time: iso(time),
    tags: [],
    creator: 'Sarah',
    pee: true,
    poo: false,
  };
}

function feeding(id: string, time: number): FeedingEntry {
  return {
    id,
    childId: 'c1',
    type: 'feeding',
    time: iso(time),
    tags: [],
    creator: 'Sarah',
    kind: 'formula',
    method: 'bottle',
    amount: 100,
  };
}

describe('activeDayCount', () => {
  it('counts distinct 24h buckets that hold an entry, any type', () => {
    const entries: Entry[] = [
      feeding('f1', NOW - 2 * HOUR), // bucket 0
      diaper('d1', NOW - 5 * HOUR), // bucket 0 (same day → not double-counted)
      diaper('d2', NOW - 26 * HOUR), // bucket 1
      feeding('f2', NOW - 3 * DAY - HOUR), // bucket 3
    ];
    expect(activeDayCount(entries, NOW, 7, 0)).toBe(3);
  });

  it('respects the offset — the food-trend window skips today', () => {
    const entries: Entry[] = [
      feeding('today', NOW - HOUR), // bucket 0, excluded by offset 1
      feeding('yest', NOW - 26 * HOUR), // bucket 1, counted
    ];
    expect(activeDayCount(entries, NOW, 7, 1)).toBe(1);
  });

  it('ignores entries outside the window and in the future', () => {
    const entries: Entry[] = [
      feeding('old', NOW - 9 * DAY), // bucket 9, outside a 7-day window
      feeding('future', NOW + 2 * HOUR), // negative age, ignored
      feeding('in', NOW - 4 * DAY), // bucket 4, counted
    ];
    expect(activeDayCount(entries, NOW, 7, 0)).toBe(1);
  });
});

describe('inactiveBaselineDays / hasInactiveBaselineDays', () => {
  it('reports the days of the 7-day baseline that had no entry', () => {
    // Entries only on baseline buckets 1 and 3 → 5 inactive baseline days.
    const entries: Entry[] = [feeding('a', NOW - 26 * HOUR), feeding('b', NOW - 3 * DAY - HOUR)];
    expect(inactiveBaselineDays(entries, NOW)).toBe(5);
    expect(hasInactiveBaselineDays(entries, NOW)).toBe(true);
  });

  it('stays quiet when every baseline day is active', () => {
    const entries: Entry[] = Array.from({ length: 7 }, (_, i) =>
      feeding(`p${i}`, NOW - (i + 1) * DAY - HOUR),
    );
    expect(inactiveBaselineDays(entries, NOW)).toBe(0);
    expect(hasInactiveBaselineDays(entries, NOW)).toBe(false);
  });

  it('stays quiet with no baseline history at all — nothing to dilute', () => {
    // Only today has entries; the baseline window (buckets 1..7) is empty.
    expect(hasInactiveBaselineDays([feeding('t', NOW - HOUR)], NOW)).toBe(false);
    expect(inactiveBaselineDays([feeding('t', NOW - HOUR)], NOW)).toBe(7);
  });
});
