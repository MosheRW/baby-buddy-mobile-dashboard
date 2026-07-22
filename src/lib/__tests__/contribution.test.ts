import { computeContribution, contributionBody } from '../contribution';
import type { DiaperEntry, Entry, FeedingEntry, MedicationEntry } from '../../api/types';
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
