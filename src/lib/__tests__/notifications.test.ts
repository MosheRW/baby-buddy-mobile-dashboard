import {
  activeDeferrals,
  buildNotifications,
  buildOngoingMedChronometers,
  buildOngoingTimerChronometers,
  buildOngoingTimerNotifications,
  intervalStep,
  nextWeeklySlot,
  notificationAction,
  type NotificationSettings,
  type TimingPrefs,
  type NotificationBuildInput,
} from '../notifications';
import type { Child, DiaperEntry, Entry, FeedingEntry, MedicationEntry } from '../../api/types';
import type { RunningTimer } from '../timers';
import i18n from '../../i18n';

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

function diaper(time: string, over: Partial<DiaperEntry> = {}): DiaperEntry {
  return {
    id: over.id ?? `diaper-${time}`,
    childId: over.childId ?? 'c1',
    type: 'diaper',
    time,
    tags: [],
    creator: 'Sarah',
    pee: true,
    poo: false,
    ...over,
  };
}

function feeding(time: string, over: Partial<FeedingEntry> = {}): FeedingEntry {
  return {
    id: over.id ?? `feeding-${time}`,
    childId: over.childId ?? 'c1',
    type: 'feeding',
    time,
    tags: [],
    creator: 'Sarah',
    kind: 'formula',
    method: 'bottle',
    ...over,
  };
}

function child(id: string, name: string): Child {
  return {
    id,
    name,
    initial: name[0],
    hue: 30,
    birthDate: '2025-12-19',
    age: '7 months old',
    defaultFoodMl: 120,
  };
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
    forgottenTimer: { enabled: false, thresholdMinutes: 30, sleepThresholdMinutes: 240 },
    diaperInterval: { enabled: false },
    foodMin: { enabled: false, timing: timing() },
    liveTimer: { enabled: false },
    liveMed: { enabled: false },
    // Off in the shared helper so the existing exact-count assertions aren't
    // perturbed; the weekly-summary block enables it explicitly.
    weeklySummary: { enabled: false, weekday: 0, hour: 9 },
    perChild: {},
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
      input({
        entries,
        settings: settings({
          masterEnabled: false,
          scheduledMeds: { enabled: true, timing: timing() },
        }),
      }),
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
  const scheduledOn = (t: TimingPrefs) => settings({ scheduledMeds: { enabled: true, timing: t } });

  it('expands before/at/after around the due time', () => {
    const entries: Entry[] = [
      med({ name: 'Amoxicillin', time: iso(NOW - HOUR), repeatHours: 8, schedule: 'scheduled' }),
    ];
    const plan = buildNotifications(
      input({
        entries,
        settings: scheduledOn(timing({ before: true, at: true, after: true, afterMinutes: 20 })),
      }),
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
    const plan = buildNotifications(
      input({ entries, settings: scheduledOn(timing({ at: true })) }),
      NOW,
    );
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
        settings: scheduledOn(
          timing({ before: true, beforeMinutes: 0, at: false, after: true, afterMinutes: 0 }),
        ),
      }),
      NOW,
    );
    expect(plan).toEqual([]);
  });
});

describe('buildNotifications — medication eligibility', () => {
  const eligOn = () =>
    settings({ medEligibility: { enabled: true, timing: timing({ at: true }) } });

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
  const timerOn = (thresholdMinutes = 30, sleepThresholdMinutes = 240) =>
    settings({ forgottenTimer: { enabled: true, thresholdMinutes, sleepThresholdMinutes } });

  const runningTimer = (over: Partial<RunningTimer> = {}): RunningTimer => ({
    type: 'feeding',
    childId: 'c1',
    startedAt: NOW - 10 * MINUTE,
    ...over,
  });

  it('schedules a reminder at start + threshold for a running timer', () => {
    const plan = buildNotifications(
      input({ timers: [runningTimer()], settings: timerOn(30) }),
      NOW,
    );
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

  it('uses the separate sleep threshold, not the general one, for a sleep timer', () => {
    // A sleep timer running 30m with a 30m general threshold would fire now for
    // any other type; sleep uses its own (240m) threshold, so it's 4h out.
    const plan = buildNotifications(
      input({
        timers: [runningTimer({ type: 'sleep', startedAt: NOW - 30 * MINUTE })],
        settings: timerOn(30, 240),
      }),
      NOW,
    );
    expect(plan).toHaveLength(1);
    expect(plan[0].key).toBe('timer:sleep:c1');
    expect(plan[0].fireAt).toBe(NOW - 30 * MINUTE + 240 * MINUTE);
  });

  it('honors a configured sleep threshold independent of the general one', () => {
    const plan = buildNotifications(
      input({
        timers: [runningTimer({ type: 'sleep', startedAt: NOW })],
        settings: timerOn(30, 300),
      }),
      NOW,
    );
    expect(plan[0].fireAt).toBe(NOW + 300 * MINUTE);
  });

  it('leaves the general threshold applying to non-sleep timers', () => {
    const plan = buildNotifications(
      input({
        timers: [runningTimer({ type: 'tummyTime', startedAt: NOW })],
        settings: timerOn(45, 300),
      }),
      NOW,
    );
    expect(plan[0].key).toBe('timer:tummyTime:c1');
    expect(plan[0].fireAt).toBe(NOW + 45 * MINUTE);
  });
});

describe('buildNotifications — snoozedUntil', () => {
  const timerOn = (thresholdMinutes = 30, sleepThresholdMinutes = 240) =>
    settings({ forgottenTimer: { enabled: true, thresholdMinutes, sleepThresholdMinutes } });

  const runningTimer = (over: Partial<RunningTimer> = {}): RunningTimer => ({
    type: 'feeding',
    childId: 'c1',
    startedAt: NOW - 10 * MINUTE,
    ...over,
  });

  it('postpones a candidate to the snooze time when it is later than the natural fireAt', () => {
    const naturalFireAt = NOW - 10 * MINUTE + 30 * MINUTE; // NOW + 20m
    const snoozeUntil = NOW + 45 * MINUTE;
    const plan = buildNotifications(
      input({
        timers: [runningTimer()],
        settings: timerOn(30),
        snoozedUntil: { 'timer:feeding:c1': snoozeUntil },
      }),
      NOW,
    );
    expect(plan).toHaveLength(1);
    expect(plan[0].fireAt).toBe(snoozeUntil);
    expect(plan[0].fireAt).toBeGreaterThan(naturalFireAt);
  });

  it('ignores a snooze earlier than the natural fireAt — never pulls a reminder forward', () => {
    const plan = buildNotifications(
      input({
        timers: [runningTimer()],
        settings: timerOn(30),
        snoozedUntil: { 'timer:feeding:c1': NOW + 1 * MINUTE },
      }),
      NOW,
    );
    expect(plan[0].fireAt).toBe(NOW - 10 * MINUTE + 30 * MINUTE);
  });

  it('brings back an already-past candidate that was snoozed into the future', () => {
    // Past its natural threshold, so with no snooze it would be dropped entirely.
    const plan = buildNotifications(
      input({
        timers: [runningTimer({ startedAt: NOW - 50 * MINUTE })],
        settings: timerOn(30),
        snoozedUntil: { 'timer:feeding:c1': NOW + 15 * MINUTE },
      }),
      NOW,
    );
    expect(plan).toHaveLength(1);
    expect(plan[0].fireAt).toBe(NOW + 15 * MINUTE);
  });

  it('leaves other keys unaffected', () => {
    const plan = buildNotifications(
      input({
        timers: [runningTimer()],
        settings: timerOn(30),
        snoozedUntil: { 'diaper:c1': NOW + 999 * MINUTE },
      }),
      NOW,
    );
    expect(plan[0].fireAt).toBe(NOW - 10 * MINUTE + 30 * MINUTE);
  });
});

describe('buildNotifications — diaper interval', () => {
  const diaperOn = (thresholds?: { diaperIntervalMinutes?: number }) =>
    settings({
      diaperInterval: { enabled: true },
      perChild: thresholds ? { c1: thresholds } : {},
    });

  it('schedules at the last change + the per-child interval', () => {
    const entries: Entry[] = [diaper(iso(NOW - HOUR))];
    const plan = buildNotifications(
      input({ entries, settings: diaperOn({ diaperIntervalMinutes: 180 }) }),
      NOW,
    );
    expect(plan).toHaveLength(1);
    expect(plan[0].key).toBe('diaper:c1');
    expect(plan[0].fireAt).toBe(NOW - HOUR + 3 * HOUR);
    expect(plan[0].childId).toBe('c1');
    expect(plan[0].body).toContain('Emma');
  });

  it('anchors on the most recent change', () => {
    const entries: Entry[] = [diaper(iso(NOW - 5 * HOUR)), diaper(iso(NOW - HOUR))];
    const plan = buildNotifications(
      input({ entries, settings: diaperOn({ diaperIntervalMinutes: 180 }) }),
      NOW,
    );
    expect(plan[0].fireAt).toBe(NOW - HOUR + 3 * HOUR);
  });

  it('applies the default interval when the child has no threshold', () => {
    const entries: Entry[] = [diaper(iso(NOW - 30 * MINUTE))];
    const plan = buildNotifications(input({ entries, settings: diaperOn() }), NOW);
    expect(plan).toHaveLength(1);
    expect(plan[0].fireAt).toBe(NOW - 30 * MINUTE + 3 * HOUR);
  });

  it('opts a child out with a zero threshold', () => {
    const entries: Entry[] = [diaper(iso(NOW - HOUR))];
    const plan = buildNotifications(
      input({ entries, settings: diaperOn({ diaperIntervalMinutes: 0 }) }),
      NOW,
    );
    expect(plan).toEqual([]);
  });

  it('skips a child with no diaper history', () => {
    const plan = buildNotifications(input({ entries: [], settings: diaperOn() }), NOW);
    expect(plan).toEqual([]);
  });

  it('drops a change already past its interval', () => {
    const entries: Entry[] = [diaper(iso(NOW - 5 * HOUR))];
    const plan = buildNotifications(
      input({ entries, settings: diaperOn({ diaperIntervalMinutes: 180 }) }),
      NOW,
    );
    expect(plan).toEqual([]);
  });

  it('is silent when the case is disabled', () => {
    const entries: Entry[] = [diaper(iso(NOW - HOUR))];
    expect(buildNotifications(input({ entries }), NOW)).toEqual([]);
  });
});

describe('buildNotifications — food minimum interval', () => {
  const foodOn = (thresholds: { foodMinIntervalMinutes?: number; foodMinMl?: number } = {}) =>
    settings({ foodMin: { enabled: true, timing: timing() }, perChild: { c1: thresholds } });

  it('schedules at the last feed + the per-child interval', () => {
    const entries: Entry[] = [feeding(iso(NOW - HOUR), { amount: 60 })];
    const plan = buildNotifications(
      input({ entries, settings: foodOn({ foodMinIntervalMinutes: 240 }) }),
      NOW,
    );
    expect(plan).toHaveLength(1);
    expect(plan[0].key).toBe('food:c1:at');
    expect(plan[0].fireAt).toBe(NOW - HOUR + 4 * HOUR);
    expect(plan[0].body).toContain('Emma');
  });

  it('names the target amount when foodMinMl is set', () => {
    const entries: Entry[] = [feeding(iso(NOW - HOUR))];
    const plan = buildNotifications(
      input({ entries, settings: foodOn({ foodMinIntervalMinutes: 240, foodMinMl: 120 }) }),
      NOW,
    );
    expect(plan[0].body).toContain('120');
  });

  it('uses the default interval when only the case is enabled', () => {
    const entries: Entry[] = [feeding(iso(NOW - HOUR))];
    const plan = buildNotifications(
      input({ entries, settings: settings({ foodMin: { enabled: true, timing: timing() } }) }),
      NOW,
    );
    expect(plan).toHaveLength(1);
    expect(plan[0].fireAt).toBe(NOW - HOUR + 4 * HOUR);
  });

  it('skips a child with no feeding history', () => {
    const plan = buildNotifications(
      input({ entries: [], settings: settings({ foodMin: { enabled: true, timing: timing() } }) }),
      NOW,
    );
    expect(plan).toEqual([]);
  });

  it('is silent when the case is disabled', () => {
    const entries: Entry[] = [feeding(iso(NOW - HOUR))];
    expect(buildNotifications(input({ entries }), NOW)).toEqual([]);
  });
});

describe('buildNotifications — localization', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('he');
  });
  afterAll(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders titles and bodies in the active language, with the child interpolated', () => {
    const entries: Entry[] = [med({ name: 'Amoxicillin', time: iso(NOW - HOUR), repeatHours: 8 })];
    const plan = buildNotifications(
      input({
        entries,
        settings: settings({ scheduledMeds: { enabled: true, timing: timing({ at: true }) } }),
      }),
      NOW,
    );
    expect(plan[0].title).toBe('הגיע זמן התרופה');
    expect(plan[0].body).toBe('Amoxicillin עבור Emma אמורה להינתן עכשיו.');
  });
});

describe('buildNotifications — weekly summary', () => {
  const DAY = 24 * HOUR;
  const weeklyOn = (over: Partial<{ weekday: number; hour: number }> = {}) =>
    settings({ weeklySummary: { enabled: true, weekday: 0, hour: 9, ...over } });

  it('schedules one weekly summary at the configured slot when I have activity', () => {
    const entries: Entry[] = [diaper(iso(NOW - DAY)), feeding(iso(NOW - 2 * DAY))];
    const plan = buildNotifications(input({ entries, settings: weeklyOn(), me: 'Sarah' }), NOW);
    const weekly = plan.filter((n) => n.key === 'weekly');
    expect(weekly).toHaveLength(1);
    expect(weekly[0].fireAt).toBe(nextWeeklySlot(NOW, 0, 9));
    expect(weekly[0].childId).toBeUndefined();
    expect(weekly[0].title).toBeTruthy();
  });

  it('compares against the other caregivers when there are any', () => {
    const entries: Entry[] = [
      diaper(iso(NOW - DAY), { creator: 'Sarah' }),
      diaper(iso(NOW - DAY), { creator: 'Alex', id: 'd-alex' }),
      feeding(iso(NOW - DAY), { creator: 'Alex', id: 'f-alex' }),
    ];
    const plan = buildNotifications(input({ entries, settings: weeklyOn(), me: 'Sarah' }), NOW);
    const weekly = plan.find((n) => n.key === 'weekly')!;
    // I logged 1 of 3 → 33%.
    expect(weekly.body).toContain('1 of 3');
    expect(weekly.body).toContain('33%');
  });

  it('is exempt from the 48h horizon (fires up to a week out)', () => {
    // ~4 days ahead of NOW's local weekday, guaranteed past the 48h horizon.
    const weekday = (new Date(NOW).getDay() + 4) % 7;
    const entries: Entry[] = [diaper(iso(NOW - DAY))];
    const plan = buildNotifications(
      input({ entries, settings: weeklyOn({ weekday }), me: 'Sarah' }),
      NOW,
    );
    const weekly = plan.find((n) => n.key === 'weekly')!;
    expect(weekly.fireAt).toBeGreaterThan(NOW + 48 * HOUR);
  });

  it('is silent when nothing was logged all week', () => {
    const entries: Entry[] = [diaper(iso(NOW - 10 * DAY))]; // outside the 7-day window
    const plan = buildNotifications(input({ entries, settings: weeklyOn(), me: 'Sarah' }), NOW);
    expect(plan.some((n) => n.key === 'weekly')).toBe(false);
  });

  it('is silent when the signed-in caregiver is unknown', () => {
    const entries: Entry[] = [diaper(iso(NOW - DAY))];
    const plan = buildNotifications(input({ entries, settings: weeklyOn(), me: undefined }), NOW);
    expect(plan.some((n) => n.key === 'weekly')).toBe(false);
  });

  it('is silent when the case is disabled', () => {
    const entries: Entry[] = [diaper(iso(NOW - DAY))];
    const plan = buildNotifications(input({ entries, me: 'Sarah' }), NOW);
    expect(plan.some((n) => n.key === 'weekly')).toBe(false);
  });

  it('counts only the visible children when a visibility scope is given', () => {
    const entries: Entry[] = [
      diaper(iso(NOW - DAY), { creator: 'Sarah' }),
      diaper(iso(NOW - DAY), { creator: 'Alex', id: 'd-alex', childId: 'hidden-kid' }),
      feeding(iso(NOW - DAY), { creator: 'Alex', id: 'f-alex', childId: 'hidden-kid' }),
    ];
    const plan = buildNotifications(
      input({ entries, settings: weeklyOn(), me: 'Sarah', visibleChildIds: ['c1'] }),
      NOW,
    );
    const weekly = plan.find((n) => n.key === 'weekly')!;
    // Alex's entries were all logged for the hidden child, so this reads solo.
    expect(weekly.body).not.toContain('%');
    expect(weekly.body).toContain('Diaper 1');
  });

  it('drops the summary entirely when every visible child was idle', () => {
    const entries: Entry[] = [diaper(iso(NOW - DAY), { childId: 'hidden-kid' })];
    const plan = buildNotifications(
      input({ entries, settings: weeklyOn(), me: 'Sarah', visibleChildIds: ['c1'] }),
      NOW,
    );
    expect(plan.some((n) => n.key === 'weekly')).toBe(false);
  });

  it('splits the body by kid group when there is more than one bucket', () => {
    const children = [child('c1', 'Emma'), child('c2', 'Noah')];
    const entries: Entry[] = [
      diaper(iso(NOW - DAY)),
      feeding(iso(NOW - DAY), { id: 'f-noah', childId: 'c2' }),
    ];
    const plan = buildNotifications(
      input({
        entries,
        children,
        settings: weeklyOn(),
        me: 'Sarah',
        kidGroups: {
          childGroupId: { c1: 'g1' },
          groups: { g1: { id: 'g1', name: 'Twins', order: 0 } },
        },
      }),
      NOW,
    );
    const weekly = plan.find((n) => n.key === 'weekly')!;
    expect(weekly.body.split('\n')[1]).toBe('By group: Twins 1 · Noah 1');
  });

  it('leaves a single-child account with a one-line body', () => {
    const entries: Entry[] = [diaper(iso(NOW - DAY))];
    const plan = buildNotifications(input({ entries, settings: weeklyOn(), me: 'Sarah' }), NOW);
    expect(plan.find((n) => n.key === 'weekly')!.body).not.toContain('\n');
  });

  it('leaves the reminder cases outside the visibility scope', () => {
    // A hidden child's medication is still due — hiding is a display choice.
    const entries: Entry[] = [
      med({ name: 'Amoxicillin', time: iso(NOW - HOUR), repeatHours: 2, childId: 'c1' }),
    ];
    const plan = buildNotifications(
      input({
        entries,
        settings: settings({ scheduledMeds: { enabled: true, timing: timing() } }),
        visibleChildIds: [],
      }),
      NOW,
    );
    expect(plan.some((n) => n.key.startsWith('sched:'))).toBe(true);
  });
});

describe('nextWeeklySlot', () => {
  it('lands on the requested local weekday and hour, strictly in the future', () => {
    for (let weekday = 0; weekday < 7; weekday++) {
      const slot = nextWeeklySlot(NOW, weekday, 9);
      const d = new Date(slot);
      expect(slot).toBeGreaterThan(NOW);
      expect(d.getDay()).toBe(weekday);
      expect(d.getHours()).toBe(9);
      expect(slot - NOW).toBeLessThanOrEqual(7 * 24 * HOUR);
    }
  });
});

describe('buildNotifications — horizon + ordering', () => {
  it('drops reminders beyond the 48h horizon', () => {
    const entries: Entry[] = [
      // scheduled 100h out — far past the horizon, and past neededMeds' ±24h too.
      med({ name: 'Far', time: iso(NOW - HOUR), repeatHours: 100, schedule: 'scheduled' }),
    ];
    const plan = buildNotifications(
      input({
        entries,
        settings: settings({ scheduledMeds: { enabled: true, timing: timing() } }),
      }),
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
        timers: [{ type: 'feeding', childId: 'c1', startedAt: NOW - 5 * MINUTE }],
        settings: settings({
          scheduledMeds: { enabled: true, timing: timing({ at: true }) },
          forgottenTimer: { enabled: true, thresholdMinutes: 30, sleepThresholdMinutes: 240 },
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

describe('intervalStep', () => {
  it('nudges by single minutes below 10', () => {
    expect(intervalStep(0)).toBe(1);
    expect(intervalStep(5)).toBe(1);
    expect(intervalStep(9)).toBe(1);
  });

  it('nudges by 5 minutes from 10 up to an hour', () => {
    expect(intervalStep(10)).toBe(5);
    expect(intervalStep(30)).toBe(5);
    expect(intervalStep(59)).toBe(5);
  });

  it('nudges by 10 minutes from an hour up', () => {
    expect(intervalStep(60)).toBe(10);
    expect(intervalStep(240)).toBe(10);
  });
});

describe('notificationAction', () => {
  it('routes all three medication cases to the med breakdown', () => {
    // Keys as buildNotifications writes them: `${prefix}:${child}:${name}:${kind}`.
    expect(notificationAction('sched:c1:tylenol:at')).toEqual({ kind: 'medication' });
    expect(notificationAction('elig:c1:ibuprofen:before')).toEqual({ kind: 'medication' });
    expect(notificationAction('cap:c1:tylenol:after')).toEqual({ kind: 'medication' });
  });

  it('routes a forgotten-timer key to its timer type', () => {
    expect(notificationAction('timer:feeding:c1')).toEqual({ kind: 'timer', timerType: 'feeding' });
    expect(notificationAction('timer:sleep:c2')).toEqual({ kind: 'timer', timerType: 'sleep' });
    expect(notificationAction('timer:tummyTime:c1')).toEqual({
      kind: 'timer',
      timerType: 'tummyTime',
    });
  });

  it('routes diaper/food keys to a create form for that type', () => {
    expect(notificationAction('diaper:c1')).toEqual({ kind: 'create', entryType: 'diaper' });
    expect(notificationAction('food:c1')).toEqual({ kind: 'create', entryType: 'feeding' });
  });

  it('leaves the weekly summary and unknown keys inert', () => {
    expect(notificationAction('weekly')).toEqual({ kind: 'none' });
    expect(notificationAction('timer:bogus:c1')).toEqual({ kind: 'none' });
    expect(notificationAction('something-else')).toEqual({ kind: 'none' });
  });
});

describe('buildOngoingTimerNotifications', () => {
  const runningTimer = (over: Partial<RunningTimer> = {}): RunningTimer => ({
    type: 'feeding',
    childId: 'c1',
    startedAt: NOW - 5 * MINUTE,
    ...over,
  });

  const liveSettings = (over: Partial<NotificationSettings> = {}) =>
    settings({ liveTimer: { enabled: true }, ...over });

  it('is empty when the master switch is off', () => {
    const out = buildOngoingTimerNotifications(
      {
        timers: [runningTimer()],
        children: CHILDREN,
        settings: liveSettings({ masterEnabled: false }),
      },
      NOW,
    );
    expect(out).toEqual([]);
  });

  it('is empty when the live-timer case is off', () => {
    const out = buildOngoingTimerNotifications(
      { timers: [runningTimer()], children: CHILDREN, settings: settings() },
      NOW,
    );
    expect(out).toEqual([]);
  });

  it('is empty when no timer is running', () => {
    const out = buildOngoingTimerNotifications(
      { timers: [], children: CHILDREN, settings: liveSettings() },
      NOW,
    );
    expect(out).toEqual([]);
  });

  it('emits one notification per running timer, keyed by type + child', () => {
    const out = buildOngoingTimerNotifications(
      {
        timers: [
          runningTimer({ type: 'feeding', childId: 'c1' }),
          runningTimer({ type: 'sleep', childId: 'c1' }),
        ],
        children: CHILDREN,
        settings: liveSettings(),
      },
      NOW,
    );
    expect(out.map((o) => o.key)).toEqual(['ongoing:feeding:c1', 'ongoing:sleep:c1']);
    expect(out.every((o) => o.childId === 'c1')).toBe(true);
    // The minute-granular fallback carries the same cancel/end buttons as the
    // native chronometer, so the two live-timer tracks behave alike.
    expect(out.map((o) => o.actions)).toEqual([
      ['cancel-feeding', 'end-feeding'],
      ['cancel-sleep', 'end-sleep'],
    ]);
  });

  it('names the child and the elapsed time in the body', () => {
    const [note] = buildOngoingTimerNotifications(
      {
        timers: [runningTimer({ startedAt: NOW - 5 * MINUTE })],
        children: CHILDREN,
        settings: liveSettings(),
      },
      NOW,
    );
    expect(note.title).toBe('Feeding timer running');
    expect(note.body).toContain('Emma');
    expect(note.body).toContain('5m');
  });

  it('floors the elapsed label so it never runs ahead of the timer', () => {
    // 5m31s elapsed — countdownLabel rounds, so without flooring this would
    // render "6m" and appear to overstate the elapsed time.
    const [note] = buildOngoingTimerNotifications(
      {
        timers: [runningTimer({ startedAt: NOW - (5 * MINUTE + 31_000) })],
        children: CHILDREN,
        settings: liveSettings(),
      },
      NOW,
    );
    expect(note.body).toContain('5m');
    expect(note.body).not.toContain('6m');
  });

  it('falls back to the no-child body when the child is unknown', () => {
    const [note] = buildOngoingTimerNotifications(
      {
        timers: [runningTimer({ childId: 'ghost' })],
        children: CHILDREN,
        settings: liveSettings(),
      },
      NOW,
    );
    expect(note.body).not.toContain('·');
    expect(note.body).toContain('Running for');
  });
});

describe('buildOngoingTimerChronometers', () => {
  const runningTimer = (over: Partial<RunningTimer> = {}): RunningTimer => ({
    type: 'feeding',
    childId: 'c1',
    startedAt: NOW - 5 * MINUTE,
    ...over,
  });
  const liveSettings = (over: Partial<NotificationSettings> = {}) =>
    settings({ liveTimer: { enabled: true }, ...over });

  it('is empty when the master switch or the live-timer case is off', () => {
    expect(
      buildOngoingTimerChronometers({
        timers: [runningTimer()],
        children: CHILDREN,
        settings: liveSettings({ masterEnabled: false }),
      }),
    ).toEqual([]);
    expect(
      buildOngoingTimerChronometers({
        timers: [runningTimer()],
        children: CHILDREN,
        settings: settings(),
      }),
    ).toEqual([]);
  });

  it('anchors the chronometer at the timer start and counts up', () => {
    const started = NOW - 5 * MINUTE;
    const [spec] = buildOngoingTimerChronometers({
      timers: [runningTimer({ startedAt: started })],
      children: CHILDREN,
      settings: liveSettings(),
    });
    expect(spec.key).toBe('ongoing:feeding:c1');
    expect(spec.anchorMs).toBe(started);
    expect(spec.countDown).toBe(false);
    // The OS draws the clock, so the text is only the child name — no duration.
    expect(spec.title).toBe('Feeding timer running');
    expect(spec.text).toBe('Emma');
    expect(spec.text).not.toMatch(/\d/);
  });

  it('carries the per-type cancel/end buttons for the running timer', () => {
    const [spec] = buildOngoingTimerChronometers({
      timers: [runningTimer({ type: 'sleep' })],
      children: CHILDREN,
      settings: liveSettings(),
    });
    expect(spec.actions).toEqual(['cancel-sleep', 'end-sleep']);
  });

  it('uses the no-child text when the child is unknown', () => {
    const [spec] = buildOngoingTimerChronometers({
      timers: [runningTimer({ childId: 'ghost' })],
      children: CHILDREN,
      settings: liveSettings(),
    });
    expect(spec.text).toBe('Running');
  });
});

describe('buildOngoingMedChronometers', () => {
  const liveMedOn = (over: Partial<NotificationSettings> = {}) =>
    settings({ liveMed: { enabled: true }, ...over });

  // A scheduled med taken 7h50m ago on an 8h cycle → due in 10 min (inside the
  // 15-min live window).
  const dueSoon = () => med({ name: 'Tylenol', time: iso(NOW - (8 * HOUR - 10 * MINUTE)) });
  // Taken 9h ago on an 8h cycle → overdue by 1h. The live countdown is upcoming-
  // only, so an overdue dose gets no chronometer (no negative clock, no lingering).
  const overdue = () => med({ name: 'Tylenol', time: iso(NOW - 9 * HOUR) });
  // Taken 7h30m ago on an 8h cycle → due in 30 min (just outside the 15-min lead).
  const soonButNotYet = () => med({ name: 'Tylenol', time: iso(NOW - (8 * HOUR - 30 * MINUTE)) });
  // Taken 1h ago on an 8h cycle → due in 7h (well outside the lead window).
  const farOff = () => med({ name: 'Tylenol', time: iso(NOW - 1 * HOUR) });
  // An as-needed medicine that became eligible again 5 min ago — no fixed clock
  // time, so it must NOT get a live countdown (only scheduled meds do).
  const asNeededReady = () =>
    med({ name: 'Ibuprofen', schedule: 'asNeeded', time: iso(NOW - (8 * HOUR + 5 * MINUTE)) });

  it('is empty when the master switch or the live-med case is off', () => {
    expect(
      buildOngoingMedChronometers(
        { entries: [dueSoon()], children: CHILDREN, settings: liveMedOn({ masterEnabled: false }) },
        NOW,
      ),
    ).toEqual([]);
    expect(
      buildOngoingMedChronometers(
        { entries: [dueSoon()], children: CHILDREN, settings: settings() },
        NOW,
      ),
    ).toEqual([]);
  });

  it('counts down toward the due time for a dose about to come due', () => {
    const [spec] = buildOngoingMedChronometers(
      { entries: [dueSoon()], children: CHILDREN, settings: liveMedOn() },
      NOW,
    );
    expect(spec.key).toBe('ongoing-med:c1:tylenol');
    expect(spec.anchorMs).toBe(NOW + 10 * MINUTE);
    expect(spec.countDown).toBe(true);
    expect(spec.title).toBe('Medication due');
    expect(spec.text).toContain('Tylenol');
    expect(spec.text).toContain('Emma');
  });

  it('drops an overdue dose — no negative clock, no ticking-since-given', () => {
    // The whole point of the upcoming-only window: an overdue dose (anchor in the
    // past) would render as a negative count-down and sit there for hours. The
    // fire-once "due"/"overdue" reminders cover the overdue case instead.
    expect(
      buildOngoingMedChronometers(
        { entries: [overdue()], children: CHILDREN, settings: liveMedOn() },
        NOW,
      ),
    ).toEqual([]);
  });

  it('anchors on a strictly-future due time, so the clock never goes negative', () => {
    const [spec] = buildOngoingMedChronometers(
      { entries: [dueSoon()], children: CHILDREN, settings: liveMedOn() },
      NOW,
    );
    expect(spec.anchorMs).toBeGreaterThan(NOW);
    expect(spec.countDown).toBe(true);
  });

  it('omits a dose that is not yet near due', () => {
    expect(
      buildOngoingMedChronometers(
        { entries: [farOff()], children: CHILDREN, settings: liveMedOn() },
        NOW,
      ),
    ).toEqual([]);
  });

  it('omits a scheduled dose still 30 min out — the window is the last 15 min', () => {
    expect(
      buildOngoingMedChronometers(
        { entries: [soonButNotYet()], children: CHILDREN, settings: liveMedOn() },
        NOW,
      ),
    ).toEqual([]);
  });

  it('never shows a live countdown for an as-needed medicine, even when due soon', () => {
    // As-needed / 24h-cap meds become "allowed again", not "due at a time"; they
    // keep their fire-once alert but must not get a ticking notification.
    expect(
      buildOngoingMedChronometers(
        { entries: [asNeededReady()], children: CHILDREN, settings: liveMedOn() },
        NOW,
      ),
    ).toEqual([]);
  });

  it('dedupes to one countdown per (child, medicine)', () => {
    const specs = buildOngoingMedChronometers(
      {
        entries: [dueSoon(), med({ name: 'Tylenol', time: iso(NOW - (8 * HOUR - 5 * MINUTE)) })],
        children: CHILDREN,
        settings: liveMedOn(),
      },
      NOW,
    );
    expect(specs).toHaveLength(1);
    expect(specs[0].key).toBe('ongoing-med:c1:tylenol');
  });

  it('gives each child their own countdown for the same-named medicine', () => {
    // Both kids on Tylenol, both due soon. neededMeds dedupes by name globally,
    // so a naive merged pass would drop one child; per-child scoping keeps both.
    const specs = buildOngoingMedChronometers(
      {
        entries: [
          med({ name: 'Tylenol', childId: 'c1', time: iso(NOW - (8 * HOUR - 10 * MINUTE)) }),
          med({ name: 'Tylenol', childId: 'c2', time: iso(NOW - (8 * HOUR - 12 * MINUTE)) }),
        ],
        children: [child('c1', 'Emma'), child('c2', 'Noah')],
        settings: liveMedOn(),
      },
      NOW,
    );
    expect(specs.map((s) => s.key).sort()).toEqual([
      'ongoing-med:c1:tylenol',
      'ongoing-med:c2:tylenol',
    ]);
    expect(specs.find((s) => s.childId === 'c2')?.anchorMs).toBe(NOW + 12 * MINUTE);
  });
});

// --- Action buttons (issue #45) ---------------------------------------------
//
// The buttons live in the planner because *which* ones apply depends on the
// phase and on which other offsets are enabled — neither recoverable from the
// key. These cover every row of the design's table, including both branches of
// each conditional.
describe('buildNotifications — action buttons', () => {
  const byKey = (plan: { key: string; actions?: string[] }[], suffix: string) =>
    plan.find((p) => p.key.endsWith(suffix))?.actions;

  const scheduledDose = () => med({ name: 'Tylenol', time: iso(NOW - 7 * HOUR) });

  function medPlan(over: Partial<TimingPrefs>) {
    return buildNotifications(
      input({
        entries: [scheduledDose()],
        settings: settings({
          scheduledMeds: { enabled: true, timing: timing({ before: true, after: true, ...over }) },
        }),
      }),
      NOW,
    );
  }

  it('offers "remind on time" on a before reminder only when "at" is off', () => {
    expect(byKey(medPlan({ at: true }), ':before')).toEqual(['ok']);
    expect(byKey(medPlan({ at: false }), ':before')).toEqual(['ok', 'remind-on-time']);
  });

  it('offers "remind later" on an at reminder only when "after" is off', () => {
    expect(byKey(medPlan({ after: true }), ':at')).toEqual(['add-now']);
    expect(byKey(medPlan({ after: false }), ':at')).toEqual(['add-now', 'remind-later']);
  });

  it('always offers add-now and remind-later on an after reminder', () => {
    expect(byKey(medPlan({}), ':after')).toEqual(['add-now', 'remind-later']);
  });

  it('carries the source dose so "add now" can prefill a repeat', () => {
    const plan = medPlan({ at: true });
    expect(plan.every((p) => p.prefillMedEntryId === scheduledDose().id)).toBe(true);
  });

  it('gives the diaper reminder ok / add-now / remind-later', () => {
    const plan = buildNotifications(
      input({
        entries: [diaper(iso(NOW - HOUR))],
        settings: settings({
          diaperInterval: { enabled: true },
          perChild: { c1: { diaperIntervalMinutes: 180 } },
        }),
      }),
      NOW,
    );
    expect(plan[0].actions).toEqual(['ok', 'add-now', 'remind-later']);
  });

  it('leads every food phase with add-now', () => {
    const plan = buildNotifications(
      input({
        entries: [feeding(iso(NOW - HOUR))],
        settings: settings({
          foodMin: {
            enabled: true,
            timing: timing({ before: true, at: false, after: false }),
          },
          perChild: { c1: { foodMinIntervalMinutes: 240 } },
        }),
      }),
      NOW,
    );
    expect(byKey(plan, ':before')).toEqual(['add-now', 'remind-on-time']);
  });

  it('gives a forgotten timer its own cancel/end pair', () => {
    const plan = buildNotifications(
      input({
        timers: [{ type: 'sleep', childId: 'c1', startedAt: NOW - 10 * MINUTE }],
        settings: settings({
          forgottenTimer: { enabled: true, thresholdMinutes: 30, sleepThresholdMinutes: 60 },
        }),
      }),
      NOW,
    );
    expect(plan[0].actions).toEqual(['cancel-sleep', 'end-sleep']);
  });

  it('leaves the weekly summary button-less', () => {
    const plan = buildNotifications(
      input({
        entries: [diaper(iso(NOW - HOUR))],
        me: 'Sarah',
        settings: settings({ weeklySummary: { enabled: true, weekday: 0, hour: 9 } }),
      }),
      NOW,
    );
    expect(plan.find((p) => p.key === 'weekly')?.actions).toBeUndefined();
  });
});

describe('buildNotifications — forgotten timer vs. the live timer notification', () => {
  const timers: RunningTimer[] = [{ type: 'sleep', childId: 'c1', startedAt: NOW - 10 * MINUTE }];
  const forgotten = { enabled: true, thresholdMinutes: 30, sleepThresholdMinutes: 60 };

  it('schedules the reminder while the live running-timer notification is off', () => {
    const plan = buildNotifications(
      input({ timers, settings: settings({ forgottenTimer: forgotten }) }),
      NOW,
    );
    expect(plan.map((p) => p.key)).toEqual(['timer:sleep:c1']);
  });

  it('suppresses it while the live running-timer notification is on', () => {
    // The tray already shows this timer ticking; a "did you forget?" alert on
    // top of it is noise. Keyed on the setting, not on native support.
    const plan = buildNotifications(
      input({
        timers,
        settings: settings({ forgottenTimer: forgotten, liveTimer: { enabled: true } }),
      }),
      NOW,
    );
    expect(plan).toEqual([]);
  });
});

describe('buildNotifications — remind me on time', () => {
  const dose = () => med({ name: 'Tylenol', time: iso(NOW - 7 * HOUR) });
  // "at" off, so nothing would normally fire at the due moment.
  const atOff = settings({
    scheduledMeds: { enabled: true, timing: timing({ before: true, at: false }) },
  });

  it('emits the on-time reminder for a promoted anchor', () => {
    const promoted = { 'sched:c1:tylenol:at': NOW + 2 * HOUR };
    const plan = buildNotifications(
      input({ entries: [dose()], settings: atOff, remindOnTime: promoted }),
      NOW,
    );
    expect(plan.map((p) => p.key)).toContain('sched:c1:tylenol:at');
    // The promotion is per-anchor, so an unrelated medicine is untouched.
    const other = buildNotifications(input({ entries: [dose()], settings: atOff }), NOW);
    expect(other.map((p) => p.key)).not.toContain('sched:c1:tylenol:at');
  });

  it('fires it at the anchor, not earlier', () => {
    const plan = buildNotifications(
      input({
        entries: [dose()],
        settings: atOff,
        remindOnTime: { 'sched:c1:tylenol:at': NOW + 2 * HOUR },
      }),
      NOW,
    );
    expect(plan.find((p) => p.key === 'sched:c1:tylenol:at')?.fireAt).toBe(NOW + HOUR);
  });
});

describe('activeDeferrals', () => {
  it('keeps only entries still in the future', () => {
    expect(activeDeferrals({ a: NOW + MINUTE, b: NOW - MINUTE, c: NOW }, NOW)).toEqual({
      a: NOW + MINUTE,
    });
  });
});
