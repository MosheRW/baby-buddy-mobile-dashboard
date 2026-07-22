/**
 * Notification planning — pure, unit-tested, no `expo-notifications` import.
 *
 * `buildNotifications` turns the current data (entries, running timers, children)
 * plus the user's settings into a flat list of `PlannedNotification`s: each is a
 * single future OS-scheduled local notification. The native service
 * (`src/notifications/service.ts`) diffs this list against what's already
 * scheduled and reconciles — this module never touches the platform.
 *
 * Every reminder is a *future timestamp we can compute now*, which is why local
 * scheduling works without a push backend:
 *  - scheduled / as-needed meds → the `dueAt` already computed by
 *    `neededMeds` / `eligibleMeds` / `medLimitSummaries` (src/lib/medication.ts).
 *  - forgotten timers → `startedAt + threshold`.
 *
 * All five cases are wired here: scheduled meds, medication eligibility, and
 * forgotten timers use the before/at/after timing model; diaper-interval and
 * food-min are per-child "time since the last one" reminders (a single fire at
 * the deadline, like the forgotten-timer case — no before/at/after).
 */
import i18n from '../i18n';
import type { Child, Entry, EntryType } from '../api/types';
import { eligibleMeds, medLimitSummaries, neededMeds, countdownLabel } from './medication';
import { computeContribution, contributionBody } from './contribution';
import { TIMER_TYPES, type RunningTimer, type TimerType } from './timers';

const MINUTE = 60_000;
/** Don't schedule further out than this — the plan is rebuilt on every refresh. */
const HORIZON_MS = 48 * 60 * MINUTE;
/**
 * The weekly-summary slot can be up to a week out, so it's exempt from the 48h
 * horizon (which exists for data-anchored reminders that shift on every refresh).
 * Its body is a snapshot of the trailing week, re-taken every time the plan is
 * rebuilt — accurate as of the last time the app was open before it fires.
 */
const WEEKLY_KEY = 'weekly';
/** OS-scheduled-notification budgets are finite; keep the list bounded. */
const MAX_PLANNED = 64;

/**
 * Applied to every child once the diaper/food case is on, unless that child
 * carries its own threshold (in minutes). A per-child value of 0 opts out.
 */
export const DEFAULT_DIAPER_INTERVAL_MINUTES = 180;
export const DEFAULT_FOOD_INTERVAL_MINUTES = 240;

/**
 * Adaptive step size (minutes) for the time-interval steppers: single minutes
 * below 10, five up to an hour, ten beyond. Keeps fine control where the value
 * is small without making multi-hour intervals a tap marathon.
 */
export function intervalStep(minutes: number): number {
  if (minutes < 10) return 1;
  if (minutes < 60) return 5;
  return 10;
}

// --- Settings shapes (shared with the store) --------------------------------

/**
 * Which of "shortly before / at the time / shortly after" a reminder fires, and
 * the lead/lag for the before/after ones. A case can enable one or more.
 */
export interface TimingPrefs {
  before: boolean;
  beforeMinutes: number;
  at: boolean;
  after: boolean;
  afterMinutes: number;
}

export interface CaseSettings {
  enabled: boolean;
  timing: TimingPrefs;
}

/**
 * Per-child thresholds for the diaper/food cases. A missing value means "use the
 * case default"; an explicit 0 means "don't remind for this child".
 */
export interface PerChildThresholds {
  /** Max minutes between diaper changes before a reminder fires. */
  diaperIntervalMinutes?: number;
  /** Target amount (ml) mentioned in the food reminder; 0/absent = don't mention. */
  foodMinMl?: number;
  /**
   * Max minutes between feeds. Doubles as the dashboard food-total window for
   * this child, so it's edited even when notifications are off.
   */
  foodMinIntervalMinutes?: number;
}

/**
 * The weekly caregiver-contribution summary. `weekday` is 0=Sunday..6=Saturday
 * and `hour` is a local 0–23 hour; together they pick the slot the recap fires.
 */
export interface WeeklySummarySettings {
  enabled: boolean;
  weekday: number;
  hour: number;
}

/** The subset of notification settings the builder reads. */
export interface NotificationSettings {
  masterEnabled: boolean;
  scheduledMeds: CaseSettings;
  medEligibility: CaseSettings;
  forgottenTimer: { enabled: boolean; thresholdMinutes: number };
  diaperInterval: { enabled: boolean };
  foodMin: { enabled: boolean };
  weeklySummary: WeeklySummarySettings;
  perChild: Record<string, PerChildThresholds>;
}

// --- Output -----------------------------------------------------------------

export interface PlannedNotification {
  /**
   * Stable identity, independent of `fireAt`, so the service can diff plans
   * across rebuilds and leave unchanged reminders alone (no re-alert churn).
   */
  key: string;
  /** Epoch ms the OS should deliver it. Always strictly in the future here. */
  fireAt: number;
  title: string;
  body: string;
  childId?: string;
}

export interface NotificationBuildInput {
  entries: Entry[];
  timers: RunningTimer[];
  children: Child[];
  settings: NotificationSettings;
  /** Signed-in caregiver's display name, for the weekly-summary "you" tally. */
  me?: string;
}

type OffsetKind = 'before' | 'at' | 'after';

/** Expand a timing spec around an anchor into its enabled fire points. */
function expand(timing: TimingPrefs, anchor: number): { kind: OffsetKind; fireAt: number }[] {
  const out: { kind: OffsetKind; fireAt: number }[] = [];
  // A zero lead/lag would collapse onto the "at" point — skip it rather than
  // emit two notifications at the same instant.
  if (timing.before && timing.beforeMinutes > 0)
    out.push({ kind: 'before', fireAt: anchor - timing.beforeMinutes * MINUTE });
  if (timing.at) out.push({ kind: 'at', fireAt: anchor });
  if (timing.after && timing.afterMinutes > 0)
    out.push({ kind: 'after', fireAt: anchor + timing.afterMinutes * MINUTE });
  return out;
}

/**
 * Copy is localized through the shared i18n instance (see src/i18n) — the same
 * pattern the medication/date helpers use. The child suffix ("… for Emma") is a
 * per-locale sentence variant selected by i18next's `_noChild` context rather
 * than a concatenated fragment, so RTL languages can place it grammatically.
 */
const MED_KIND_KEY: Record<OffsetKind, string> = {
  before: 'medDueBefore',
  at: 'medDueAt',
  after: 'medDueAfter',
};
const ELIG_KIND_KEY: Record<OffsetKind, string> = {
  before: 'eligBefore',
  at: 'eligAt',
  after: 'eligAfter',
};

/** i18next appends `_noChild` when no child name resolved. */
function childContext(child: string | undefined) {
  return child ? undefined : 'noChild';
}

function medBody(kind: OffsetKind, med: string, child: string | undefined, minutes: number): string {
  return i18n.t(`notifications.${MED_KIND_KEY[kind]}`, {
    context: childContext(child),
    med,
    child,
    duration: countdownLabel(minutes * MINUTE),
  });
}

function eligibleBody(
  kind: OffsetKind,
  med: string,
  child: string | undefined,
  minutes: number,
): string {
  return i18n.t(`notifications.${ELIG_KIND_KEY[kind]}`, {
    context: childContext(child),
    med,
    child,
    duration: countdownLabel(minutes * MINUTE),
  });
}

/** Lead/lag magnitude in minutes for a given kind. */
function minutesFor(kind: OffsetKind, timing: TimingPrefs): number {
  return kind === 'before' ? timing.beforeMinutes : kind === 'after' ? timing.afterMinutes : 0;
}

/**
 * Next local-time occurrence of `weekday` (0=Sun..6=Sat) at `hour`:00, strictly
 * in the future relative to `now`. Uses local calendar fields so "Sunday 9am"
 * means the user's Sunday 9am, not UTC's.
 */
export function nextWeeklySlot(now: number, weekday: number, hour: number): number {
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  let daysAhead = (weekday - d.getDay() + 7) % 7;
  // Same weekday but the hour has already passed today → jump a full week.
  if (daysAhead === 0 && d.getTime() <= now) daysAhead = 7;
  d.setDate(d.getDate() + daysAhead);
  return d.getTime();
}

/** Epoch ms of the most recent entry of `type` for `childId`, or null if none. */
function lastEntryOfType(entries: Entry[], childId: string, type: EntryType): number | null {
  let latest: number | null = null;
  for (const e of entries) {
    if (e.type !== type || e.childId !== childId) continue;
    const at = new Date(e.time).getTime();
    if (latest == null || at > latest) latest = at;
  }
  return latest;
}

/**
 * Build the full set of reminders that should currently be scheduled. Returns
 * strictly-future notifications within the planning horizon, soonest first, and
 * capped — a past `at`/`before` is silently dropped so an overdue dose only ever
 * surfaces through its "after" reminder.
 */
export function buildNotifications(
  input: NotificationBuildInput,
  now: number = Date.now(),
): PlannedNotification[] {
  const { entries, timers, children, settings, me } = input;
  if (!settings.masterEnabled) return [];

  const childName = new Map(children.map((c) => [c.id, c.name]));
  // MedStatus carries the source entry id but not the child; resolve it here.
  const childOfEntry = new Map(entries.map((e) => [e.id, e.childId]));
  const out: PlannedNotification[] = [];

  const nameKey = (s: string) => s.trim().toLowerCase();

  // 1. Scheduled medications ------------------------------------------------
  // neededMeds dedupes scheduled meds by name across children, so if two
  // children are on the same medicine only the most-recent one is reminded —
  // acceptable for the MVP.
  if (settings.scheduledMeds.enabled) {
    const timing = settings.scheduledMeds.timing;
    for (const s of neededMeds(entries, now)) {
      const childId = childOfEntry.get(s.entryId);
      const who = childId ? childName.get(childId) : undefined;
      for (const { kind, fireAt } of expand(timing, s.dueAt)) {
        out.push({
          key: `sched:${childId ?? '?'}:${nameKey(s.name)}:${kind}`,
          fireAt,
          title: i18n.t('notifications.titleMedDue'),
          body: medBody(kind, s.name, who, minutesFor(kind, timing)),
          childId,
        });
      }
    }
  }

  // 2. Medication eligibility (as-needed interval + 24h-cap interval) --------
  // eligibleMeds and medLimitSummaries are disjoint by construction (eligibleMeds
  // excludes any pair that carries a 24h limit), so a medicine is never reminded
  // by both branches.
  if (settings.medEligibility.enabled) {
    const timing = settings.medEligibility.timing;

    for (const s of eligibleMeds(entries, now)) {
      const childId = childOfEntry.get(s.entryId);
      const who = childId ? childName.get(childId) : undefined;
      for (const { kind, fireAt } of expand(timing, s.dueAt)) {
        out.push({
          key: `elig:${childId ?? '?'}:${nameKey(s.name)}:${kind}`,
          fireAt,
          title: i18n.t('notifications.titleMedReady'),
          body: eligibleBody(kind, s.name, who, minutesFor(kind, timing)),
          childId,
        });
      }
    }

    for (const s of medLimitSummaries(entries, now)) {
      const who = childName.get(s.childId);
      for (const { kind, fireAt } of expand(timing, s.dueAt)) {
        out.push({
          key: `cap:${s.childId}:${nameKey(s.name)}:${kind}`,
          fireAt,
          title: i18n.t('notifications.titleMedReady'),
          body: eligibleBody(kind, s.name, who, minutesFor(kind, timing)),
          childId: s.childId,
        });
      }
    }
  }

  // 3. Forgotten timers -----------------------------------------------------
  if (settings.forgottenTimer.enabled) {
    const threshold = settings.forgottenTimer.thresholdMinutes;
    for (const rt of timers) {
      const who = childName.get(rt.childId);
      out.push({
        key: `timer:${rt.type}:${rt.childId}`,
        fireAt: rt.startedAt + threshold * MINUTE,
        title: i18n.t('notifications.titleTimerRunning'),
        body: i18n.t('notifications.timerBody', {
          context: childContext(who),
          activity: i18n.t(`timer.typeLabel.${rt.type}`),
          child: who,
          duration: countdownLabel(threshold * MINUTE),
        }),
        childId: rt.childId,
      });
    }
  }

  // 4. Diaper interval (per child) -----------------------------------------
  // Anchored on the child's last diaper change: fire once, `interval` after it.
  // With no diaper history there's nothing to anchor on, so the child is skipped
  // (the same "no data → no reminder" rule the medication cases follow).
  if (settings.diaperInterval.enabled) {
    for (const child of children) {
      const minutes =
        settings.perChild[child.id]?.diaperIntervalMinutes ?? DEFAULT_DIAPER_INTERVAL_MINUTES;
      if (minutes <= 0) continue;
      const last = lastEntryOfType(entries, child.id, 'diaper');
      if (last == null) continue;
      out.push({
        key: `diaper:${child.id}`,
        fireAt: last + minutes * MINUTE,
        title: i18n.t('notifications.titleDiaperDue'),
        body: i18n.t('notifications.diaperBody', {
          child: child.name,
          duration: countdownLabel(minutes * MINUTE),
        }),
        childId: child.id,
      });
    }
  }

  // 5. Food minimum interval (per child) ------------------------------------
  // Anchored on the child's last feed. `foodMinMl`, when set, is surfaced in the
  // copy as a target — it's advisory, not a scheduling gate (a future amount
  // can't be measured now), so the reminder is fundamentally a "time since last
  // feed" nudge, parallel to the diaper case.
  if (settings.foodMin.enabled) {
    for (const child of children) {
      const t = settings.perChild[child.id];
      const minutes = t?.foodMinIntervalMinutes ?? DEFAULT_FOOD_INTERVAL_MINUTES;
      if (minutes <= 0) continue;
      const last = lastEntryOfType(entries, child.id, 'feeding');
      if (last == null) continue;
      const minMl = t?.foodMinMl ?? 0;
      out.push({
        key: `food:${child.id}`,
        fireAt: last + minutes * MINUTE,
        title: i18n.t('notifications.titleFoodDue'),
        body: i18n.t(minMl > 0 ? 'notifications.foodBodyMin' : 'notifications.foodBody', {
          child: child.name,
          duration: countdownLabel(minutes * MINUTE),
          min: minMl,
        }),
        childId: child.id,
      });
    }
  }

  // 6. Weekly caregiver-contribution summary --------------------------------
  // Calendar-anchored (not data-anchored) and up to a week out, so it's built
  // and horizon-exempted separately below. The body is a trailing-7-day snapshot
  // computed now; with nothing logged all week there's nothing to recap, so it's
  // skipped — the same "no data → no reminder" rule the other cases follow.
  if (settings.weeklySummary.enabled && me) {
    const summary = computeContribution(entries, me, now);
    if (summary.allTotal > 0) {
      out.push({
        key: WEEKLY_KEY,
        fireAt: nextWeeklySlot(now, settings.weeklySummary.weekday, settings.weeklySummary.hour),
        title: i18n.t('notifications.titleWeekly'),
        body: contributionBody(summary),
      });
    }
  }

  return out
    .filter((n) => n.fireAt > now && (n.key === WEEKLY_KEY || n.fireAt <= now + HORIZON_MS))
    .sort((a, b) => a.fireAt - b.fireAt)
    .slice(0, MAX_PLANNED);
}

/**
 * What tapping a delivered notification should open, derived from its key (the
 * `PlannedNotification.key` we scheduled it under — the OS keeps it as the
 * notification's identifier, so it round-trips back unchanged).
 *
 *  - the three medication cases (`sched`/`elig`/`cap`) → the med breakdown sheet
 *    for that child, the one place to review status and log a dose.
 *  - a forgotten timer → the log-entry form for that timer type (to stop/save it).
 *  - diaper / food → a prefilled create form for that entry type.
 *  - the weekly summary (and anything unrecognised) → nothing to open.
 *
 * `none` means "not a tap target" — the carousel leaves those cards inert rather
 * than offering a tap that goes nowhere.
 */
export type NotificationAction =
  | { kind: 'medication' }
  | { kind: 'timer'; timerType: TimerType }
  | { kind: 'create'; entryType: 'diaper' | 'feeding' }
  | { kind: 'none' };

export function notificationAction(key: string): NotificationAction {
  if (key.startsWith('sched:') || key.startsWith('elig:') || key.startsWith('cap:'))
    return { kind: 'medication' };
  if (key.startsWith('timer:')) {
    // `timer:${type}:${childId}` — the type is the second segment.
    const type = key.split(':')[1];
    if (type && (TIMER_TYPES as readonly string[]).includes(type))
      return { kind: 'timer', timerType: type as TimerType };
    return { kind: 'none' };
  }
  if (key.startsWith('diaper:')) return { kind: 'create', entryType: 'diaper' };
  if (key.startsWith('food:')) return { kind: 'create', entryType: 'feeding' };
  return { kind: 'none' };
}
