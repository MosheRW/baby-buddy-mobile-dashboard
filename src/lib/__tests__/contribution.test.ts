import {
  computeContribution,
  computeGroupContributions,
  contributionBody,
  entriesForChildren,
} from '../contribution';
import type { Child, DiaperEntry, Entry, FeedingEntry, MedicationEntry } from '../../api/types';
import i18n from '../../i18n';

const DAY = 24 * 60 * 60_000;
const NOW = new Date('2026-07-19T12:00:00Z').getTime();
const iso = (ms: number) => new Date(ms).toISOString();

let seq = 0;
function diaper(at: number, creator: string): DiaperEntry {
  return {
    id: `d${seq++}`,
    childId: 'c1',
    type: 'diaper',
    time: iso(at),
    tags: [],
    creator,
    pee: true,
    poo: false,
  };
}

function feeding(at: number, creator: string): FeedingEntry {
  return {
    id: `f${seq++}`,
    childId: 'c1',
    type: 'feeding',
    time: iso(at),
    tags: [],
    creator,
    kind: 'formula',
    method: 'bottle',
  };
}

function med(at: number, creator: string): MedicationEntry {
  return {
    id: `m${seq++}`,
    childId: 'c1',
    type: 'medication',
    time: iso(at),
    tags: [],
    creator,
    name: 'Tylenol',
    dose: 5,
    doseUnit: 'ml',
    schedule: 'asNeeded',
    repeatHours: 6,
  };
}

describe('computeContribution', () => {
  it('tallies my entries per category and the family totals over the window', () => {
    const entries: Entry[] = [
      diaper(NOW - DAY, 'Sarah'),
      diaper(NOW - 2 * DAY, 'Sarah'),
      diaper(NOW - DAY, 'Alex'),
      feeding(NOW - DAY, 'Sarah'),
      feeding(NOW - DAY, 'Alex'),
      med(NOW - DAY, 'Alex'),
    ];
    const s = computeContribution(entries, 'Sarah', NOW);

    expect(s.myTotal).toBe(3);
    expect(s.allTotal).toBe(6);
    expect(s.overallShare).toBeCloseTo(0.5);
    expect(s.caregivers).toBe(2);

    const byType = Object.fromEntries(s.categories.map((c) => [c.type, c]));
    expect(byType.diaper).toEqual({ type: 'diaper', mine: 2, total: 3 });
    expect(byType.feeding).toEqual({ type: 'feeding', mine: 1, total: 2 });
    expect(byType.medication).toEqual({ type: 'medication', mine: 0, total: 1 });
  });

  it('excludes entries outside the trailing window', () => {
    const entries: Entry[] = [diaper(NOW - DAY, 'Sarah'), diaper(NOW - 10 * DAY, 'Sarah')];
    const s = computeContribution(entries, 'Sarah', NOW);
    expect(s.allTotal).toBe(1);
    expect(s.myTotal).toBe(1);
  });

  it('ignores future-dated entries', () => {
    const entries: Entry[] = [diaper(NOW + DAY, 'Sarah'), diaper(NOW - DAY, 'Sarah')];
    expect(computeContribution(entries, 'Sarah', NOW).allTotal).toBe(1);
  });

  it('matches the caregiver by normalized name', () => {
    const entries: Entry[] = [diaper(NOW - DAY, '  Sarah ')];
    expect(computeContribution(entries, 'sarah', NOW).myTotal).toBe(1);
  });

  it('lists only categories with activity, in canonical order', () => {
    const entries: Entry[] = [feeding(NOW - DAY, 'Sarah'), diaper(NOW - DAY, 'Sarah')];
    const s = computeContribution(entries, 'Sarah', NOW);
    expect(s.categories.map((c) => c.type)).toEqual(['diaper', 'feeding']);
  });

  it('counts a single caregiver as solo (share 0 when nobody is me)', () => {
    const entries: Entry[] = [diaper(NOW - DAY, 'Alex')];
    const s = computeContribution(entries, 'Sarah', NOW);
    expect(s.caregivers).toBe(1);
    expect(s.myTotal).toBe(0);
    expect(s.overallShare).toBe(0);
  });

  it('reports zeros with no entries', () => {
    const s = computeContribution([], 'Sarah', NOW);
    expect(s).toMatchObject({ myTotal: 0, allTotal: 0, overallShare: 0, caregivers: 0 });
    expect(s.categories).toEqual([]);
  });
});

describe('contributionBody', () => {
  it('includes the comparison when other caregivers logged this week', () => {
    const entries: Entry[] = [
      diaper(NOW - DAY, 'Sarah'),
      diaper(NOW - DAY, 'Alex'),
      feeding(NOW - DAY, 'Alex'),
    ];
    const body = contributionBody(computeContribution(entries, 'Sarah', NOW));
    expect(body).toContain('1 of 3');
    expect(body).toContain('33%');
    // Category breakdown uses mine/total pairs.
    expect(body).toContain('Diaper 1/2');
    expect(body).toContain('Feeding 0/1');
  });

  it('drops the meaningless comparison when I am the only caregiver', () => {
    const entries: Entry[] = [diaper(NOW - DAY, 'Sarah'), feeding(NOW - DAY, 'Sarah')];
    const body = contributionBody(computeContribution(entries, 'Sarah', NOW));
    expect(body).not.toContain('%');
    expect(body).toContain('Diaper 1');
    expect(body).toContain('Feeding 1');
    expect(body).not.toContain('/');
  });

  it('renders in the active language', async () => {
    await i18n.changeLanguage('he');
    try {
      const entries: Entry[] = [diaper(NOW - DAY, 'Sarah'), diaper(NOW - DAY, 'Alex')];
      const body = contributionBody(computeContribution(entries, 'Sarah', NOW));
      expect(body).toContain('50%');
      expect(body).toContain('השבוע');
    } finally {
      await i18n.changeLanguage('en');
    }
  });
});

// --- Grouped breakdown ------------------------------------------------------

function child(id: string, name: string): Child {
  return {
    id,
    name,
    initial: name[0],
    hue: 200,
    birthDate: '2026-01-01',
    age: '6 months old',
    defaultFoodMl: 120,
  };
}

/** Same entry, reassigned to another child. */
function forChild<T extends Entry>(entry: T, childId: string): T {
  return { ...entry, childId };
}

describe('entriesForChildren', () => {
  it('keeps only entries logged for the given children', () => {
    const entries: Entry[] = [
      diaper(NOW - DAY, 'Sarah'),
      forChild(diaper(NOW - DAY, 'Sarah'), 'c2'),
      forChild(diaper(NOW - DAY, 'Sarah'), 'c3'),
    ];
    expect(entriesForChildren(entries, ['c1', 'c3'])).toHaveLength(2);
    expect(entriesForChildren(entries, [])).toEqual([]);
  });
});

describe('computeGroupContributions', () => {
  const twins = { id: 'g1', name: 'Twins', order: 0 };

  it('pools grouped children and leaves an ungrouped child as its own bucket', () => {
    const children = [child('c1', 'Ada'), child('c2', 'Ben'), child('c3', 'Cleo')];
    const state = { childGroupId: { c1: 'g1', c2: 'g1' }, groups: { g1: twins } };
    const entries: Entry[] = [
      diaper(NOW - DAY, 'Sarah'), // c1
      forChild(feeding(NOW - DAY, 'Alex'), 'c2'),
      forChild(diaper(NOW - DAY, 'Alex'), 'c3'),
    ];

    const buckets = computeGroupContributions(entries, children, state, 'Sarah', NOW);

    expect(buckets.map((b) => [b.id, b.label, b.isGroup])).toEqual([
      ['g1', 'Twins', true],
      ['c3', 'Cleo', false],
    ]);
    expect(buckets[0].childIds).toEqual(['c1', 'c2']);
    expect(buckets[0].summary).toMatchObject({ myTotal: 1, allTotal: 2 });
    expect(buckets[1].summary).toMatchObject({ myTotal: 0, allTotal: 1 });
  });

  it('counts only the children it is given, so hidden ones drop out entirely', () => {
    // The caller passes visibility-filtered children; Ben (c2) is hidden here.
    const state = { childGroupId: {}, groups: {} };
    const entries: Entry[] = [
      diaper(NOW - DAY, 'Sarah'),
      forChild(diaper(NOW - DAY, 'Sarah'), 'c2'),
    ];

    const buckets = computeGroupContributions(
      entries,
      [child('c1', 'Ada')],
      state,
      'Sarah',
      NOW,
    );

    expect(buckets).toHaveLength(1);
    expect(buckets[0].summary).toMatchObject({ myTotal: 1, allTotal: 1 });
  });

  it('reports an empty summary for a bucket with no activity', () => {
    const state = { childGroupId: {}, groups: {} };
    const buckets = computeGroupContributions([], [child('c1', 'Ada')], state, 'Sarah', NOW);
    expect(buckets[0].summary).toMatchObject({ myTotal: 0, allTotal: 0, caregivers: 0 });
    expect(buckets[0].summary.categories).toEqual([]);
  });
});
