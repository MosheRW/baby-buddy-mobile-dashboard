import {
  neededMeds,
  eligibleMeds,
  medicationSuggestions,
  countdownLabel,
  neededStatusLabel,
  eligibleStatusLabel,
  DOSE_UNITS,
  doseFieldLabel,
  formatDose,
  medBreakdown24h,
  medLimitSummaries,
  type MedLimitSummary,
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
    doseUnit: partial.doseUnit ?? 'mg',
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

  it('excludes a one-off dose (zero interval) with no next dose to be due for', () => {
    const entries: Entry[] = [
      med({ name: 'OneOff', time: iso(NOW - 1 * HOUR), repeatHours: 0, schedule: 'scheduled' }),
    ];
    expect(neededMeds(entries, NOW)).toHaveLength(0);
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

  it('excludes a one-off PRN dose that is never eligible again', () => {
    const entries: Entry[] = [
      med({ name: 'OneOff', time: iso(NOW - 1 * HOUR), repeatHours: 0, schedule: 'asNeeded' }),
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
  it('formats as "Xh Ym", dropping a zero hour, and ignores sign', () => {
    expect(countdownLabel(7 * HOUR + 5 * 60000)).toBe('7h 5m');
    expect(countdownLabel(45 * 60000)).toBe('45m');
    expect(countdownLabel(-1000)).toBe('0m');
    // Overdue durations arrive negative; the caller supplies the wording.
    expect(countdownLabel(-(2 * HOUR))).toBe('2h 0m');
  });
});

describe('status labels', () => {
  const scheduled = (agoHours: number, repeatHours = 8) =>
    neededMeds(
      [med({ name: 'Amoxicillin', time: iso(NOW - agoHours * HOUR), repeatHours })],
      NOW,
    )[0];

  it('counts up from the last dose before the halfway point', () => {
    expect(neededStatusLabel(scheduled(1))).toBe('1h 0m since last dose');
  });

  it('counts down to the next dose past the halfway point', () => {
    expect(neededStatusLabel(scheduled(6))).toBe('due in 2h 0m');
  });

  it('names the overdue amount once past due', () => {
    expect(neededStatusLabel(scheduled(10))).toBe('overdue by 2h 0m');
  });

  it('marks a scheduled med urgent only near or past due', () => {
    expect(scheduled(1).urgent).toBe(false);
    expect(scheduled(10).urgent).toBe(true);
    // 4 minutes out, inside the 5-minute window.
    expect(neededMeds([med({ name: 'A', time: iso(NOW - (8 * HOUR - 4 * 60000)) })], NOW)[0].urgent).toBe(
      true,
    );
  });

  it('frames as-needed meds around eligibility', () => {
    const [soon] = eligibleMeds(
      [med({ name: 'Tylenol', time: iso(NOW - 5 * HOUR), repeatHours: 6, schedule: 'asNeeded' })],
      NOW,
    );
    expect(eligibleStatusLabel(soon)).toBe('eligible in 1h 0m');

    const [now] = eligibleMeds(
      [med({ name: 'Tylenol', time: iso(NOW - 7 * HOUR), repeatHours: 6, schedule: 'asNeeded' })],
      NOW,
    );
    expect(eligibleStatusLabel(now)).toBe('eligible now');
  });

  it('carries the source entry and unit for the row glyph and prefill', () => {
    const entry = med({ name: 'Tylenol', time: iso(NOW - 1 * HOUR), doseUnit: 'ml' });
    const [status] = neededMeds([entry], NOW);
    expect(status.entryId).toBe(entry.id);
    expect(status.unit).toBe('ml');
    expect(status.lastTakenAt).toBe(NOW - 1 * HOUR);
  });
});

// --- Dose units + 24h limits (Phase 8, Batch B) -----------------------------

describe('dose units', () => {
  it('gives each unit its own step and precision', () => {
    expect(DOSE_UNITS.mg).toMatchObject({ step: 1, precision: 0 });
    expect(DOSE_UNITS.ml).toMatchObject({ step: 0.1, precision: 1 });
    expect(DOSE_UNITS.tablets).toMatchObject({ step: 0.5, precision: 1 });
  });

  it('formats symbol units tight and word units spaced', () => {
    expect(formatDose(2.5, 'ml')).toBe('2.5ml');
    expect(formatDose(500, 'mg')).toBe('500mg');
    expect(formatDose(1, 'tablets')).toBe('1.0 tablets');
  });

  it('labels the dose field per unit', () => {
    expect(doseFieldLabel('tablets')).toBe('Dose (Tablets)');
  });
});

describe('medLimitSummaries', () => {
  it('sums only the trailing 24h against the pair limit', () => {
    const entries: Entry[] = [
      med({ name: 'Tylenol', time: iso(NOW - 30 * HOUR), dose: 5, maxDose24h: 20, schedule: 'asNeeded' }),
      med({ name: 'Tylenol', time: iso(NOW - 5 * HOUR), dose: 5, maxDose24h: 20, schedule: 'asNeeded' }),
      med({ name: 'Tylenol', time: iso(NOW - 2 * HOUR), dose: 5, maxDose24h: 20, schedule: 'asNeeded' }),
    ];
    const [s] = medLimitSummaries(entries, NOW);
    // The 30h-old dose is outside the window.
    expect(s.taken).toBe(10);
    expect(s.limit).toBe(20);
    expect(s.remaining).toBe(10);
    expect(s.percent).toBe(50);
    expect(s.atLimit).toBe(false);
  });

  it('reports the most recent dose time, not the oldest in the window', () => {
    const entries: Entry[] = [
      med({ name: 'Tylenol', time: iso(NOW - 9 * HOUR), dose: 5, maxDose24h: 20, schedule: 'asNeeded' }),
      med({ name: 'Tylenol', time: iso(NOW - 2 * HOUR), dose: 5, maxDose24h: 20, schedule: 'asNeeded' }),
    ];
    expect(medLimitSummaries(entries, NOW)[0].lastTakenAt).toBe(NOW - 2 * HOUR);
  });

  it('never lets one child limit bleed onto another', () => {
    // The bug this scoping exists to prevent: same medicine, two children.
    const entries: Entry[] = [
      med({ name: 'Tylenol', childId: 'emma', time: iso(NOW - 2 * HOUR), dose: 5, maxDose24h: 20, schedule: 'asNeeded' }),
      med({ name: 'Tylenol', childId: 'noah', time: iso(NOW - 1 * HOUR), dose: 3, maxDose24h: 9, schedule: 'asNeeded' }),
    ];
    const summaries = medLimitSummaries(entries, NOW);
    expect(summaries).toHaveLength(2);

    const emma = summaries.find((s) => s.childId === 'emma') as MedLimitSummary;
    const noah = summaries.find((s) => s.childId === 'noah') as MedLimitSummary;
    expect(emma).toMatchObject({ taken: 5, limit: 20 });
    expect(noah).toMatchObject({ taken: 3, limit: 9 });
  });

  it('takes the limit from the most recent entry that specifies one', () => {
    const entries: Entry[] = [
      med({ name: 'Tylenol', time: iso(NOW - 10 * HOUR), dose: 1, maxDose24h: 20, schedule: 'asNeeded' }),
      med({ name: 'Tylenol', time: iso(NOW - 3 * HOUR), dose: 1, maxDose24h: 12, schedule: 'asNeeded' }),
    ];
    expect(medLimitSummaries(entries, NOW)[0].limit).toBe(12);
  });

  it('does not let a dose logged without a limit erase the pair limit', () => {
    const entries: Entry[] = [
      med({ name: 'Tylenol', time: iso(NOW - 6 * HOUR), dose: 5, maxDose24h: 20, schedule: 'asNeeded' }),
      // Logged later, limit field left empty.
      med({ name: 'Tylenol', time: iso(NOW - 1 * HOUR), dose: 5, schedule: 'asNeeded' }),
    ];
    const [s] = medLimitSummaries(entries, NOW);
    expect(s.limit).toBe(20);
    expect(s.taken).toBe(10);
  });

  it('floors the bar at 4% and caps it at 100%', () => {
    const tiny = medLimitSummaries(
      [med({ name: 'A', time: iso(NOW - HOUR), dose: 0.1, maxDose24h: 100, schedule: 'asNeeded' })],
      NOW,
    );
    expect(tiny[0].percent).toBe(4);

    const over = medLimitSummaries(
      [med({ name: 'A', time: iso(NOW - HOUR), dose: 30, maxDose24h: 20, schedule: 'asNeeded' })],
      NOW,
    );
    expect(over[0].percent).toBe(100);
    expect(over[0].atLimit).toBe(true);
    expect(over[0].remaining).toBe(0);
  });

  it('keeps decimal sums free of floating-point noise', () => {
    const entries: Entry[] = [
      med({ name: 'A', time: iso(NOW - 2 * HOUR), dose: 2.3, maxDose24h: 10, schedule: 'asNeeded' }),
      med({ name: 'A', time: iso(NOW - HOUR), dose: 2.4, maxDose24h: 10, schedule: 'asNeeded' }),
    ];
    expect(medLimitSummaries(entries, NOW)[0].taken).toBe(4.7);
  });

  it('returns nothing when no medicine has a limit', () => {
    expect(medLimitSummaries([med({ name: 'A', time: iso(NOW) })], NOW)).toEqual([]);
  });
});

describe('eligibleMeds vs limited meds', () => {
  it('moves a limited as-needed med out of the eligible list', () => {
    // Otherwise the same medicine appears in two dashboard sections at once.
    const entries: Entry[] = [
      med({ name: 'Tylenol', time: iso(NOW - 2 * HOUR), schedule: 'asNeeded', maxDose24h: 20 }),
      med({ name: 'Ibuprofen', time: iso(NOW - 2 * HOUR), schedule: 'asNeeded' }),
    ];
    expect(eligibleMeds(entries, NOW).map((s) => s.name)).toEqual(['Ibuprofen']);
    expect(medLimitSummaries(entries, NOW).map((s) => s.name)).toEqual(['Tylenol']);
  });

  it('keeps the split per child', () => {
    const entries: Entry[] = [
      med({ name: 'Tylenol', childId: 'emma', time: iso(NOW - 2 * HOUR), schedule: 'asNeeded', maxDose24h: 20 }),
      med({ name: 'Tylenol', childId: 'noah', time: iso(NOW - 2 * HOUR), schedule: 'asNeeded' }),
    ];
    // Noah's Tylenol has no limit, so it stays eligible.
    expect(eligibleMeds(entries, NOW)).toHaveLength(1);
  });
});

describe('medBreakdown24h', () => {
  it('counts doses and totals per pair, sorted by name', () => {
    const entries: Entry[] = [
      med({ name: 'Tylenol', time: iso(NOW - 5 * HOUR), dose: 5, maxDose24h: 20 }),
      med({ name: 'Tylenol', time: iso(NOW - 2 * HOUR), dose: 5, maxDose24h: 20 }),
      med({ name: 'Amoxicillin', time: iso(NOW - 3 * HOUR), dose: 2.5 }),
    ];
    const rows = medBreakdown24h(entries, NOW);
    expect(rows.map((r) => r.name)).toEqual(['Amoxicillin', 'Tylenol']);
    expect(rows[1]).toMatchObject({ taken: 10, doses: 2, limit: 20, remaining: 10, atLimit: false });
    expect(rows[0]).toMatchObject({ taken: 2.5, doses: 1, limit: null, remaining: null });
  });

  it('keeps the limit visible after the dose that carried it ages out', () => {
    const entries: Entry[] = [
      med({ name: 'Tylenol', time: iso(NOW - 40 * HOUR), dose: 5, maxDose24h: 20 }),
      med({ name: 'Tylenol', time: iso(NOW - 2 * HOUR), dose: 5 }),
    ];
    const [row] = medBreakdown24h(entries, NOW);
    expect(row).toMatchObject({ taken: 5, doses: 1, limit: 20 });
  });

  it('excludes anything older than 24h', () => {
    expect(medBreakdown24h([med({ name: 'A', time: iso(NOW - 25 * HOUR) })], NOW)).toEqual([]);
  });
});
