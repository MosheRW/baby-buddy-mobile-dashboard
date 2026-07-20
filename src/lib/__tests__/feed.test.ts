import {
  avgBreastDuration,
  defaultTimeForMethod,
  feedingGaugePercent,
  filterAndGroup,
  foodTotal,
  foodTrend,
} from '../feed';
import type { DiaperEntry, Entry, FeedingEntry, FeedingMethod } from '../../api/types';

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

// --- Baselines, trend, gauge (Phase 8, Batch B) -----------------------------

function breastFeed(id: string, time: number, method: FeedingMethod, minutes: number): FeedingEntry {
  return {
    id,
    childId: 'c1',
    type: 'feeding',
    time: iso(time),
    tags: [],
    creator: 'Sarah',
    kind: 'breastMilk',
    method,
    durationMinutes: minutes,
  };
}

describe('avgBreastDuration', () => {
  it('averages each side independently', () => {
    // Averaging the sides together would report 10 for both, which is wrong for
    // each of them.
    const entries: Entry[] = [
      breastFeed('a', NOW - 2 * HOUR, 'leftBreast', 4),
      breastFeed('b', NOW - 3 * HOUR, 'leftBreast', 6),
      breastFeed('c', NOW - 4 * HOUR, 'rightBreast', 14),
      breastFeed('d', NOW - 5 * HOUR, 'rightBreast', 16),
    ];
    expect(avgBreastDuration(entries, 'leftBreast', 7, NOW)).toBe(5);
    expect(avgBreastDuration(entries, 'rightBreast', 7, NOW)).toBe(15);
  });

  it('ignores feeds older than the window', () => {
    const entries: Entry[] = [breastFeed('a', NOW - 8 * DAY, 'leftBreast', 20)];
    expect(avgBreastDuration(entries, 'leftBreast', 7, NOW)).toBeNull();
  });

  it('returns null with no history', () => {
    expect(avgBreastDuration([], 'leftBreast', 7, NOW)).toBeNull();
  });
});

describe('defaultTimeForMethod', () => {
  const entries: Entry[] = [
    breastFeed('a', NOW - 2 * HOUR, 'leftBreast', 5),
    breastFeed('b', NOW - 3 * HOUR, 'rightBreast', 15),
  ];

  it('sums both sides for a both-breasts feed', () => {
    expect(defaultTimeForMethod(entries, 'bothBreasts', NOW)).toBe(20);
  });

  it('uses the single side for a one-sided feed', () => {
    expect(defaultTimeForMethod(entries, 'leftBreast', NOW)).toBe(5);
  });

  it('counts a side with no history as zero, not as missing', () => {
    const leftOnly: Entry[] = [breastFeed('a', NOW - 2 * HOUR, 'leftBreast', 5)];
    expect(defaultTimeForMethod(leftOnly, 'bothBreasts', NOW)).toBe(5);
  });

  it('returns null when neither side has history, rather than a meaningless 0', () => {
    expect(defaultTimeForMethod([], 'bothBreasts', NOW)).toBeNull();
  });

  it('returns null for methods that are not direct breast', () => {
    expect(defaultTimeForMethod(entries, 'bottle', NOW)).toBeNull();
  });
});

describe('foodTrend', () => {
  it('compares today against the 7 days before it, excluding today', () => {
    const entries: Entry[] = [
      feeding('today1', NOW - 2 * HOUR, 100),
      feeding('today2', NOW - 4 * HOUR, 100),
      // 7 prior days at 100/day. Offsets 1..7 days: the baseline window is
      // (now-192h, now-24h], so an entry exactly 8 days old would fall outside.
      ...Array.from({ length: 7 }, (_, i) => feeding(`p${i}`, NOW - (i + 1) * DAY, 100)),
    ];
    const trend = foodTrend(entries, NOW);
    expect(trend.last24).toBe(200);
    expect(trend.avgPerDay).toBe(100);
    expect(trend.up).toBe(true);
    expect(trend.percent).toBe(100);
  });

  it('does not let today inflate its own baseline', () => {
    // Only today has feeds; the baseline window is empty, so avg is 0 rather
    // than being dragged up by today's own intake.
    const trend = foodTrend([feeding('t', NOW - HOUR, 150)], NOW);
    expect(trend.avgPerDay).toBe(0);
    expect(trend.last24).toBe(150);
    expect(trend.up).toBe(true);
  });

  it('reports a down day', () => {
    const entries: Entry[] = [
      feeding('today', NOW - HOUR, 50),
      ...Array.from({ length: 7 }, (_, i) => feeding(`p${i}`, NOW - (i + 1) * DAY, 200)),
    ];
    const trend = foodTrend(entries, NOW);
    expect(trend.up).toBe(false);
    expect(trend.percent).toBe(25);
  });

  it('is flat and not-up with no data at all', () => {
    expect(foodTrend([], NOW)).toMatchObject({ last24: 0, avgPerDay: 0, up: false, percent: 0 });
  });
});

describe('feedingGaugePercent', () => {
  const bottle = (amount: number, defaultQty?: number): FeedingEntry => ({
    id: 'f',
    childId: 'c1',
    type: 'feeding',
    time: iso(NOW),
    tags: [],
    creator: 'Sarah',
    kind: 'formula',
    method: 'bottle',
    amount,
    defaultQtyAtEntry: defaultQty,
  });

  it('gauges a bottle against the baseline frozen on the entry', () => {
    expect(feedingGaugePercent(bottle(60, 120))).toBe(50);
  });

  it('falls back to a fixed reference when the entry predates baselines', () => {
    expect(feedingGaugePercent(bottle(120))).toBe(50);
  });

  it('uses the smaller solid reference', () => {
    expect(
      feedingGaugePercent({ ...bottle(30), kind: 'solidFood', method: 'parentFed' }),
    ).toBe(50);
  });

  it('floors at 6% and caps at 100%', () => {
    expect(feedingGaugePercent(bottle(1, 1000))).toBe(6);
    expect(feedingGaugePercent(bottle(300, 120))).toBe(100);
  });

  it('gauges a direct-breast feed on duration against its captured baseline', () => {
    const entry: FeedingEntry = {
      ...breastFeed('b', NOW, 'leftBreast', 10),
      defaultTimeAtEntry: 20,
    };
    expect(feedingGaugePercent(entry)).toBe(50);
  });

  it('gives a breast feed no gauge without a captured baseline', () => {
    // There is no universal "normal" number of minutes to fall back on.
    expect(feedingGaugePercent(breastFeed('b', NOW, 'leftBreast', 10))).toBeNull();
  });

  it('gives an amountless, durationless feed no gauge', () => {
    expect(feedingGaugePercent(bottle(0))).toBeNull();
  });
});
