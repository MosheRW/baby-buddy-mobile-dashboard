import {
  buildNotifications,
  type NotificationSettings,
  type TimingPrefs,
  type NotificationBuildInput,
} from '../notifications';
import type { Child, Entry, MedicationEntry } from '../../api/types';
import type { RunningTimer } from '../timers';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const NOW = new Date('2026-07-19T12:00:00Z').getTime();

const iso = (ms: number) => new Date(ms).toISOString();

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

function child(id: string, name: string): Child {
  return { id, name, initial: name[0], hue: 30, age: '7 months old', defaultFoodMl: 120 };
}

const CHILDREN: Child[] = [child('c1', 'Emma')];

function timing(over: Partial<TimingPrefs> = {}): TimingPrefs {
  return { before: false, beforeMinutes: 15, at: true, after: false, afterMinutes: 15, ...over };
}

function settings(over: Partial<NotificationSettings> = {}): NotificationSettings {
  return {
    masterEnabled: true,
    scheduledMeds: { enabled: false, timing: timing() },
    medEligibility: { enabled: false, timing: timing() },
    forgottenTimer: { enabled: false, thresholdMinutes: 30 },
    ...over,
  };
}

function input(over: Partial<NotificationBuildInput>): NotificationBuildInput {
  return {
    entries: [],
    timers: [],
    children: CHILDREN,
    settings: settings(),
    ...over,
  };
}

describe('buildNotifications — master switch', () => {
  it('returns nothing when notifications are disabled', () => {
    const entries: Entry[] = [med({ name: 'Amoxicillin', time: iso(NOW - HOUR), repeatHours: 8 })];
    const plan = buildNotifications(
      input({ entries, settings: settings({ masterEnabled: false, scheduledMeds: { enabled: true, timing: timing() } }) }),
      NOW,
    );
    expect(plan).toEqual([]);
  });

  it('returns nothing when every case is disabled', () => {
    const entries: Entry[] = [med({ name: 'Amoxicillin', time: iso(NOW - HOUR), repeatHours: 8 })];
    expect(buildNotifications(input({ entries }), NOW)).toEqual([]);
  });
});

describe('buildNotifications — scheduled meds', () => {
  const scheduledOn = (t: TimingPrefs) =>
    settings({ scheduledMeds: { enabled: true, timing: t } });

  it('expands before/at/after around the due time', () => {
    const entries: Entry[] = [
      med({ name: 'Amoxicillin', time: iso(NOW - HOUR), repeatHours: 8, schedule: 'scheduled' }),
    ];
    const plan = buildNotifications(
      input({ entries, settings: scheduledOn(timing({ before: true, at: true, after: true, afterMinutes: 20 })) }),
      NOW,
    );
    // due in 7h → all three points are future and inside the horizon.
    expect(plan).toHaveLength(3);
    const kinds = plan.map((n) => n.key.split(':').pop());
    expect(new Set(kinds)).toEqual(new Set(['before', 'at', 'after']));
    // keys are child+name scoped and stable (no timestamp inside).
    expect(plan.every((n) => n.key.startsWith('sched:c1:amoxicillin:'))).toBe(true);
    expect(plan.every((n) => n.childId === 'c1')).toBe(true);
  });

  it('resolves the child name into the body', () => {
    const entries: Entry[] = [
      med({ name: 'Amoxicillin', time: iso(NOW - HOUR), repeatHours: 8, childId: 'c1' }),
    ];
    const plan = buildNotifications(input({ entries, settings: scheduledOn(timing({ at: true })) }), NOW);
    expect(plan[0].body).toContain('for Emma');
  });

  it('drops the past before/at points of an overdue dose, keeping a future after', () => {
    const entries: Entry[] = [
      med({
        name: 'Amoxicillin',
        // last dose 8h10m ago, repeat 8h → due 10m ago (overdue, within -24h).
        time: iso(NOW - (8 * HOUR + 10 * MINUTE)),
        repeatHours: 8,
        schedule: 'scheduled',
      }),
    ];
    const plan = buildNotifications(
      input({
        entries,
        settings: scheduledOn(timing({ before: true, at: true, after: true, afterMinutes: 30 })),
      }),
      NOW,
    );
    // only the "after" point (due + 30m = now + 20m) is still in the future.
    expect(plan).toHaveLength(1);
    expect(plan[0].key.endsWith(':after')).toBe(true);
    expect(plan[0].fireAt).toBeGreaterThan(NOW);
  });

  it('skips a before/after point whose lead/lag is zero', () => {
    const entries: Entry[] = [med({ name: 'Amoxicillin', time: iso(NOW - HOUR), repeatHours: 8 })];
    const plan = buildNotifications(
      input({
        entries,
        settings: scheduledOn(timing({ before: true, beforeMinutes: 0, at: false, after: true, afterMinutes: 0 })),
      }),
      NOW,
    );
    expect(plan).toEqual([]);
  });
});

describe('buildNotifications — medication eligibility', () => {
  const eligOn = () => settings({ medEligibility: { enabled: true, timing: timing({ at: true }) } });

  it('reminds an as-needed med when it becomes eligible again', () => {
    const entries: Entry[] = [
      med({ name: 'Tylenol', time: iso(NOW - HOUR), repeatHours: 4, schedule: 'asNeeded' }),
    ];
    const plan = buildNotifications(input({ entries, settings: eligOn() }), NOW);
    expect(plan).toHaveLength(1);
    expect(plan[0].key).toBe('elig:c1:tylenol:at');
    expect(plan[0].body).toContain('can be given again');
  });

  it('routes a 24h-capped med through the cap branch, not the interval branch', () => {
    const entries: Entry[] = [
      med({
        name: 'Ibuprofen',
        time: iso(NOW - HOUR),
        repeatHours: 6,
        schedule: 'asNeeded',
        maxDose24h: 30,
        dose: 10,
      }),
    ];
    const plan = buildNotifications(input({ entries, settings: eligOn() }), NOW);
    expect(plan).toHaveLength(1);
    expect(plan[0].key).toBe('cap:c1:ibuprofen:at');
  });
});

describe('buildNotifications — forgotten timers', () => {
  const timerOn = (thresholdMinutes = 30) =>
    settings({ forgottenTimer: { enabled: true, thresholdMinutes } });

  const runningTimer = (over: Partial<RunningTimer> = {}): RunningTimer => ({
    type: 'feeding',
    childId: 'c1',
    startedAt: NOW - 10 * MINUTE,
    ...over,
  });

  it('schedules a reminder at start + threshold for a running timer', () => {
    const plan = buildNotifications(input({ timers: [runningTimer()], settings: timerOn(30) }), NOW);
    expect(plan).toHaveLength(1);
    expect(plan[0].key).toBe('timer:feeding:c1');
    expect(plan[0].fireAt).toBe(NOW - 10 * MINUTE + 30 * MINUTE);
    expect(plan[0].body).toContain('Feeding timer');
  });

  it('drops a timer already past its threshold (reminder time is in the past)', () => {
    const plan = buildNotifications(
      input({ timers: [runningTimer({ startedAt: NOW - 50 * MINUTE })], settings: timerOn(30) }),
      NOW,
    );
    expect(plan).toEqual([]);
  });
});

describe('buildNotifications — horizon + ordering', () => {
  it('drops reminders beyond the 48h horizon', () => {
    const entries: Entry[] = [
      // scheduled 100h out — far past the horizon, and past neededMeds' ±24h too.
      med({ name: 'Far', time: iso(NOW - HOUR), repeatHours: 100, schedule: 'scheduled' }),
    ];
    const plan = buildNotifications(
      input({ entries, settings: settings({ scheduledMeds: { enabled: true, timing: timing() } }) }),
      NOW,
    );
    expect(plan).toEqual([]);
  });

  it('returns reminders sorted soonest-first', () => {
    const entries: Entry[] = [
      med({ name: 'A', time: iso(NOW - HOUR), repeatHours: 8, schedule: 'scheduled' }),
    ];
    const plan = buildNotifications(
      input({
        entries,
        timers: [{ type: 'sleep', childId: 'c1', startedAt: NOW - 5 * MINUTE }],
        settings: settings({
          scheduledMeds: { enabled: true, timing: timing({ at: true }) },
          forgottenTimer: { enabled: true, thresholdMinutes: 30 },
        }),
      }),
      NOW,
    );
    const times = plan.map((n) => n.fireAt);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    // timer fires at now+25m, med at now+7h → timer first.
    expect(plan[0].key.startsWith('timer:')).toBe(true);
  });
});
