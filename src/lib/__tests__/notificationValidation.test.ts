import { validateNotification } from '../notificationValidation';
import {
  buildNotifications,
  withDisclaimer,
  WEEKLY_KEY,
  type NotificationSettings,
  type TimingPrefs,
} from '../notifications';
import type { Child, DiaperEntry, Entry, MedicationEntry } from '../../api/types';
import type { RunningTimer } from '../timers';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const NOW = new Date('2026-07-19T12:00:00Z').getTime();
const DIAPER_INTERVAL = 180; // minutes — set explicitly, never the default

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

const CHILDREN: Child[] = [
  {
    id: 'c1',
    name: 'Emma',
    initial: 'E',
    hue: 30,
    birthDate: '2025-12-19',
    age: '7 months old',
    defaultFoodMl: 120,
  },
];

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
    foodMin: { enabled: false },
    liveTimer: { enabled: false },
    liveMed: { enabled: false },
    weeklySummary: { enabled: false, weekday: 0, hour: 9 },
    perChild: { c1: { diaperIntervalMinutes: DIAPER_INTERVAL } },
    ...over,
  };
}

/** A running feeding timer, started long enough ago to have tripped its threshold. */
function timer(over: Partial<RunningTimer> = {}): RunningTimer {
  return { type: 'feeding', childId: 'c1', startedAt: NOW - 30 * MINUTE, serverTimerId: 7, ...over };
}

const diaperOn = settings({ diaperInterval: { enabled: true } });
const medOn = settings({ scheduledMeds: { enabled: true, timing: timing() } });
const timerOn = settings({
  forgottenTimer: { enabled: true, thresholdMinutes: 30, sleepThresholdMinutes: 240 },
});

/** The diaper reminder for c1 fires exactly at NOW when the last change is one interval old. */
const dueDiaper = [diaper(iso(NOW - DIAPER_INTERVAL * MINUTE))];

describe('validateNotification — the premise still holds', () => {
  it('passes a diaper reminder whose deadline has arrived', () => {
    const result = validateNotification(
      { key: 'diaper:c1', entries: dueDiaper, timers: [], children: CHILDREN, settings: diaperOn },
      NOW,
    );
    expect(result.verdict).toBe('valid');
  });

  it('passes a forgotten-timer reminder while the timer is still running', () => {
    const result = validateNotification(
      { key: 'timer:feeding:c1', entries: [], timers: [timer()], children: CHILDREN, settings: timerOn },
      NOW,
    );
    expect(result.verdict).toBe('valid');
  });

  it('passes a med reminder that is due now', () => {
    // last dose 8h ago with an 8h repeat → due exactly now.
    const entries: Entry[] = [med({ name: 'Amoxicillin', time: iso(NOW - 8 * HOUR) })];
    const result = validateNotification(
      { key: 'sched:c1:amoxicillin:at', entries, timers: [], children: CHILDREN, settings: medOn },
      NOW,
    );
    expect(result.verdict).toBe('valid');
  });

  it('tolerates sub-minute jitter between the OS firing and the fetch landing', () => {
    // Deadline 30s out: the OS fired a touch early, or our fetch beat the clock.
    const entries = [diaper(iso(NOW - DIAPER_INTERVAL * MINUTE + 30_000))];
    const result = validateNotification(
      { key: 'diaper:c1', entries, timers: [], children: CHILDREN, settings: diaperOn },
      NOW,
    );
    expect(result.verdict).toBe('valid');
  });
});

describe('validateNotification — the premise is gone', () => {
  it('suppresses a diaper reminder when another caregiver logged a change', () => {
    // The server now has a change 5 minutes old, so the next deadline is hours out.
    const entries = [...dueDiaper, diaper(iso(NOW - 5 * MINUTE), { id: 'other-caregiver' })];
    const result = validateNotification(
      { key: 'diaper:c1', entries, timers: [], children: CHILDREN, settings: diaperOn },
      NOW,
    );
    expect(result.verdict).toBe('stale');
  });

  it('suppresses a forgotten-timer reminder for a timer that is no longer running', () => {
    const result = validateNotification(
      { key: 'timer:feeding:c1', entries: [], timers: [], children: CHILDREN, settings: timerOn },
      NOW,
    );
    expect(result.verdict).toBe('stale');
  });

  it('suppresses a med reminder when the dose has since been given', () => {
    const entries: Entry[] = [
      med({ name: 'Amoxicillin', time: iso(NOW - 8 * HOUR), id: 'old' }),
      // Given 10 minutes ago → next dose is 7h50m out, not now.
      med({ name: 'Amoxicillin', time: iso(NOW - 10 * MINUTE), id: 'new' }),
    ];
    const result = validateNotification(
      { key: 'sched:c1:amoxicillin:at', entries, timers: [], children: CHILDREN, settings: medOn },
      NOW,
    );
    expect(result.verdict).toBe('stale');
  });

  it('suppresses a reminder for a case the user has since switched off', () => {
    const result = validateNotification(
      { key: 'diaper:c1', entries: dueDiaper, timers: [], children: CHILDREN, settings: settings() },
      NOW,
    );
    expect(result.verdict).toBe('stale');
  });

  it('suppresses everything once the master switch is off', () => {
    const result = validateNotification(
      {
        key: 'diaper:c1',
        entries: dueDiaper,
        timers: [],
        children: CHILDREN,
        settings: settings({ masterEnabled: false, diaperInterval: { enabled: true } }),
      },
      NOW,
    );
    expect(result.verdict).toBe('stale');
  });

  it('suppresses a reminder for a child the server no longer returns', () => {
    const result = validateNotification(
      { key: 'diaper:c1', entries: dueDiaper, timers: [], children: [], settings: diaperOn },
      NOW,
    );
    expect(result.verdict).toBe('stale');
  });

  it('suppresses an unrecognised key, e.g. one left over from an older build', () => {
    const result = validateNotification(
      { key: 'nonsense:c1', entries: dueDiaper, timers: [], children: CHILDREN, settings: diaperOn },
      NOW,
    );
    expect(result.verdict).toBe('stale');
  });
});

describe('validateNotification — special cases', () => {
  it('never suppresses an ongoing running-timer notification', () => {
    // Presented from live state, not scheduled — and not even gated on the master
    // switch here, since the ongoing track clears itself when disabled.
    const result = validateNotification(
      {
        key: 'ongoing:feeding:c1',
        entries: [],
        timers: [],
        children: CHILDREN,
        settings: settings({ masterEnabled: false }),
      },
      NOW,
    );
    expect(result.verdict).toBe('valid');
  });

  it('passes the weekly summary even though its next slot is a week away', () => {
    // The fireAt test would call this stale: at the moment it fires, nextWeeklySlot
    // has already rolled forward 7 days.
    const entries = dueDiaper;
    const weekly = settings({ weeklySummary: { enabled: true, weekday: 0, hour: 9 } });
    const result = validateNotification(
      { key: WEEKLY_KEY, entries, timers: [], children: CHILDREN, settings: weekly, me: 'Sarah' },
      NOW,
    );
    expect(result.verdict).toBe('valid');
  });
});

describe('validateNotification — body correction', () => {
  it('leaves the body alone when the fresh copy matches', () => {
    const scheduled = buildNotifications(
      { entries: dueDiaper, timers: [], children: CHILDREN, settings: diaperOn },
      // Plan a minute early so the reminder is still in the future and gets planned.
      NOW - MINUTE,
    ).find((n) => n.key === 'diaper:c1');
    expect(scheduled).toBeDefined();

    const result = validateNotification(
      {
        key: 'diaper:c1',
        body: scheduled!.body,
        entries: dueDiaper,
        timers: [],
        children: CHILDREN,
        settings: diaperOn,
      },
      NOW,
    );
    expect(result.verdict).toBe('valid');
    expect(result.body).toBeUndefined();
  });

  it('drops a plan-time disclaimer once the server confirms the reminder', () => {
    const clean = buildNotifications(
      { entries: dueDiaper, timers: [], children: CHILDREN, settings: diaperOn },
      NOW - MINUTE,
    ).find((n) => n.key === 'diaper:c1')!.body;

    const result = validateNotification(
      {
        key: 'diaper:c1',
        body: withDisclaimer(clean),
        entries: dueDiaper,
        timers: [],
        children: CHILDREN,
        settings: diaperOn,
      },
      NOW,
    );
    expect(result.verdict).toBe('valid');
    expect(result.body).toBe(clean);
  });
});

describe('withDisclaimer', () => {
  it('marks a body as unconfirmed', () => {
    const marked = withDisclaimer('Emma needs a change.');
    expect(marked).toContain('Emma needs a change.');
    expect(marked).not.toBe('Emma needs a change.');
  });

  it('is idempotent — a body planned offline and delivered offline is marked once', () => {
    const once = withDisclaimer('Emma needs a change.');
    expect(withDisclaimer(once)).toBe(once);
  });
});

describe('buildNotifications — unverified plans', () => {
  it('disclaims every body when the pre-plan fetch failed', () => {
    const plan = buildNotifications(
      { entries: dueDiaper, timers: [], children: CHILDREN, settings: diaperOn, unverified: true },
      NOW - MINUTE,
    );
    expect(plan).not.toHaveLength(0);
    for (const n of plan) expect(n.body).toBe(withDisclaimer(n.body));
  });

  it('leaves bodies clean when the data was confirmed', () => {
    const plan = buildNotifications(
      { entries: dueDiaper, timers: [], children: CHILDREN, settings: diaperOn },
      NOW - MINUTE,
    );
    expect(plan).not.toHaveLength(0);
    for (const n of plan) expect(n.body).not.toBe(withDisclaimer(n.body));
  });
});
