import { filterAndGroup, foodTotal } from '../feed';
import type { DiaperEntry, Entry, FeedingEntry } from '../../api/types';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// Use local-midnight-safe anchor: noon today.
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

function feeding(id: string, time: number, amount?: number): FeedingEntry {
  return {
    id,
    childId: 'c1',
    type: 'feeding',
    time: iso(time),
    tags: [],
    creator: 'Sarah',
    kind: 'formula',
    method: 'bottle',
    amount,
  };
}

describe('filterAndGroup', () => {
  const entries: Entry[] = [
    diaper('d1', NOW - 1 * HOUR), // today
    feeding('f1', NOW - 2 * HOUR), // today
    diaper('d2', NOW - 1 * DAY - 2 * HOUR), // yesterday
    feeding('f2', NOW - 5 * DAY), // older
  ];

  it('groups by calendar day with Today/Yesterday headers, most recent first', () => {
    const groups = filterAndGroup(entries, 'all', NOW);
    expect(groups[0].header).toBe('Today');
    expect(groups[0].entries.map((e) => e.id)).toEqual(['d1', 'f1']);
    expect(groups[1].header).toBe('Yesterday');
    expect(groups[1].entries.map((e) => e.id)).toEqual(['d2']);
    expect(groups[2].entries.map((e) => e.id)).toEqual(['f2']);
  });

  it('filters by entry type', () => {
    const groups = filterAndGroup(entries, 'feeding', NOW);
    const ids = groups.flatMap((g) => g.entries.map((e) => e.id));
    expect(ids).toEqual(['f1', 'f2']);
  });

  it('returns no groups when nothing matches', () => {
    expect(filterAndGroup(entries, 'sleep', NOW)).toEqual([]);
  });
});

describe('foodTotal', () => {
  it('sums feeding amounts within the window and ignores older / amount-less feeds', () => {
    const entries: Entry[] = [
      feeding('f1', NOW - 1 * HOUR, 120),
      feeding('f2', NOW - 3 * HOUR, 100),
      feeding('f3', NOW - 5 * HOUR, 90), // outside 4h window
      feeding('f4', NOW - 30 * 60 * 1000, undefined), // no amount
    ];
    expect(foodTotal(entries, 4, NOW)).toBe(220);
  });

  it('ignores non-feeding entries', () => {
    const entries: Entry[] = [diaper('d1', NOW - 1 * HOUR), feeding('f1', NOW - 1 * HOUR, 50)];
    expect(foodTotal(entries, 4, NOW)).toBe(50);
  });
});
