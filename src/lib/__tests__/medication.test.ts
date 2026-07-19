import {
  neededMeds,
  eligibleMeds,
  medicationSuggestions,
  countdownLabel,
} from '../medication';
import type { Entry, MedicationEntry } from '../../api/types';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date('2026-07-19T12:00:00Z').getTime();

function med(partial: Partial<MedicationEntry> & { name: string; time: string }): MedicationEntry {
  return {
    id: partial.id ?? `${partial.name}-${partial.time}`,
    childId: partial.childId ?? 'c1',
    type: 'medication',
    tags: [],
    creator: 'Sarah',
    dose: partial.dose ?? 5,
    schedule: partial.schedule ?? 'scheduled',
    repeatHours: partial.repeatHours ?? 8,
    ...partial,
  };
}

const iso = (ms: number) => new Date(ms).toISOString();

describe('neededMeds (scheduled)', () => {
  it('includes a scheduled med whose next dose is within +24h and reports a future countdown', () => {
    const entries: Entry[] = [
      med({ name: 'Amoxicillin', time: iso(NOW - 1 * HOUR), repeatHours: 8, schedule: 'scheduled' }),
    ];
    const [status] = neededMeds(entries, NOW);
    expect(status.name).toBe('Amoxicillin');
    expect(status.isDue).toBe(false);
    // due at last + 8h => 7h from now
    expect(Math.round(status.dueInMs / HOUR)).toBe(7);
  });

  it('marks a past-due scheduled med as due (overdue) when within -24h', () => {
    const entries: Entry[] = [
      med({ name: 'Amoxicillin', time: iso(NOW - 10 * HOUR), repeatHours: 8, schedule: 'scheduled' }),
    ];
    const [status] = neededMeds(entries, NOW);
    expect(status.isDue).toBe(true);
    expect(status.dueInMs).toBeLessThanOrEqual(0);
  });

  it('excludes meds whose next dose is more than 24h away', () => {
    const entries: Entry[] = [
      med({ name: 'VitaminD', time: iso(NOW - 1 * HOUR), repeatHours: 48, schedule: 'scheduled' }),
    ];
    expect(neededMeds(entries, NOW)).toHaveLength(0);
  });

  it('excludes long-overdue meds beyond -24h', () => {
    const entries: Entry[] = [
      med({ name: 'Old', time: iso(NOW - 3 * DAY), repeatHours: 8, schedule: 'scheduled' }),
    ];
    expect(neededMeds(entries, NOW)).toHaveLength(0);
  });

  it('dedupes by name to the most recent dose', () => {
    const entries: Entry[] = [
      med({ name: 'Amoxicillin', time: iso(NOW - 30 * HOUR), repeatHours: 8 }),
      med({ name: 'Amoxicillin', time: iso(NOW - 2 * HOUR), repeatHours: 8 }),
    ];
    const result = neededMeds(entries, NOW);
    expect(result).toHaveLength(1);
    expect(Math.round(result[0].dueInMs / HOUR)).toBe(6); // -2h + 8h
  });

  it('ignores as-needed meds', () => {
    const entries: Entry[] = [
      med({ name: 'Tylenol', time: iso(NOW - 1 * HOUR), schedule: 'asNeeded' }),
    ];
    expect(neededMeds(entries, NOW)).toHaveLength(0);
  });

  it('sorts soonest-due first', () => {
    const entries: Entry[] = [
      med({ name: 'B', time: iso(NOW - 1 * HOUR), repeatHours: 8 }), // due +7h
      med({ name: 'A', time: iso(NOW - 6 * HOUR), repeatHours: 8 }), // due +2h
    ];
    expect(neededMeds(entries, NOW).map((s) => s.name)).toEqual(['A', 'B']);
  });
});

describe('eligibleMeds (as-needed / PRN)', () => {
  it('marks a PRN med eligible now when its interval has elapsed', () => {
    const entries: Entry[] = [
      med({ name: 'Tylenol', time: iso(NOW - 2 * DAY), repeatHours: 6, schedule: 'asNeeded' }),
    ];
    const [status] = eligibleMeds(entries, NOW);
    expect(status.name).toBe('Tylenol');
    expect(status.isDue).toBe(true);
  });

  it('shows a countdown when a PRN med is not yet eligible', () => {
    const entries: Entry[] = [
      med({ name: 'Ibuprofen', time: iso(NOW - 1 * HOUR), repeatHours: 6, schedule: 'asNeeded' }),
    ];
    const [status] = eligibleMeds(entries, NOW);
    expect(status.isDue).toBe(false);
    expect(Math.round(status.dueInMs / HOUR)).toBe(5);
  });

  it('excludes PRN meds older than 10 days', () => {
    const entries: Entry[] = [
      med({ name: 'Old', time: iso(NOW - 11 * DAY), repeatHours: 6, schedule: 'asNeeded' }),
    ];
    expect(eligibleMeds(entries, NOW)).toHaveLength(0);
  });

  it('ignores scheduled meds', () => {
    const entries: Entry[] = [
      med({ name: 'Amoxicillin', time: iso(NOW - 1 * HOUR), schedule: 'scheduled' }),
    ];
    expect(eligibleMeds(entries, NOW)).toHaveLength(0);
  });
});

describe('medicationSuggestions', () => {
  it('returns names deduped, most recent first', () => {
    const entries: Entry[] = [
      med({ name: 'Tylenol', time: iso(NOW - 3 * HOUR) }),
      med({ name: 'Amoxicillin', time: iso(NOW - 2 * HOUR) }),
      med({ name: 'Tylenol', time: iso(NOW - 1 * HOUR) }),
    ];
    expect(medicationSuggestions(entries).map((m) => m.name)).toEqual(['Tylenol', 'Amoxicillin']);
  });

  it('considers only the 20 most-recent entries before deduping', () => {
    // 20 recent "Filler" entries then an older unique "Rare" — Rare should be excluded.
    const entries: Entry[] = [
      ...Array.from({ length: 20 }, (_, i) =>
        med({ name: 'Filler', time: iso(NOW - (i + 1) * HOUR), id: `f${i}` }),
      ),
      med({ name: 'Rare', time: iso(NOW - 100 * HOUR) }),
    ];
    expect(medicationSuggestions(entries).map((m) => m.name)).toEqual(['Filler']);
  });
});

describe('countdownLabel', () => {
  it('formats as "Xh Ym" and clamps negatives to zero', () => {
    expect(countdownLabel(7 * HOUR + 5 * 60000)).toBe('7h 5m');
    expect(countdownLabel(-1000)).toBe('0h 0m');
  });
});
