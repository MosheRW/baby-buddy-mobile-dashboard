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
 * All five cases are wired here: scheduled meds, medication eligibility and
 * food-min use the before/at/after timing model; forgotten timers and the
 * diaper interval are single-fire deadlines. Each planned reminder also carries
 * the action buttons it should offer (`NotificationActionId`) — chosen here
 * because the choice depends on the phase and on which *other* offsets are
 * enabled, neither of which the native service can recover from the key.
 */
import i18n from '../i18n';
import type { Child, Entry, EntryType } from '../api/types';
import { eligibleMeds, medLimitSummaries, neededMeds, countdownLabel } from './medication';
import {
  computeContribution,
  computeGroupContributions,
  contributionBody,
  entriesForChildren,
} from './contribution';
import { TIMER_TYPES, type RunningTimer, type TimerType } from './timers';
import type { KidsVisibilityState } from './visibility';
import {
  DEFAULT_DIAPER_INTERVAL_MINUTES,
  DEFAULT_FOOD_INTERVAL_MINUTES,
  DEFAULT_SLEEP_FORGOTTEN_MINUTES,
} from './notificationDefaults';

// Re-exported so existing importers (components) keep their `./notifications`
// path; the canonical, side-effect-free home is `./notificationDefaults`.
export {
  DEFAULT_DIAPER_INTERVAL_MINUTES,
  DEFAULT_FOOD_INTERVAL_MINUTES,
  DEFAULT_SLEEP_FORGOTTEN_MINUTES,
};

const MINUTE = 60_000;
/** Don't schedule further out than this — the plan is rebuilt on every refresh. */
const HORIZON_MS = 48 * 60 * MINUTE;
/**
 * The weekly-summary slot can be up to a week out, so it's exempt from the 48h
 * horizon (which exists for data-anchored reminders that shift on every refresh).
 * Its body is a snapshot of the trailing week, re-taken every time the plan is
 * rebuilt — accurate as of the last time the app was open before it fires.
 *
 * Exported because it is also the one key `validateNotification` must special-case:
 * it's calendar-anchored, so it has no server premise that can go stale.
 */
export const WEEKLY_KEY = 'weekly';
/** OS-scheduled-notification budgets are finite; keep the list bounded. */
const MAX_PLANNED = 64;

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
  /**
   * `thresholdMinutes` applies to feeding/tummy-time timers; sleep timers use
   * `sleepThresholdMinutes` (typically much longer — a nap isn't a forgotten
   * timer). Both are in minutes.
   */
  forgottenTimer: { enabled: boolean; thresholdMinutes: number; sleepThresholdMinutes: number };
  diaperInterval: { enabled: boolean };
  /**
   * Feeding-gap reminders. Unlike the diaper case this carries the full
   * before/at/after timing model (issue #45), so a caregiver can be nudged
   * *ahead* of the next expected feed and again once it is overdue. The anchor
   * is the child's last feed plus their feeding interval.
   */
  foodMin: CaseSettings;
  /**
   * The persistent "a timer is running right now" notification — one ongoing
   * (non-dismissable) notification per running timer, presented immediately and
   * refreshed as the elapsed time grows. Unlike every other case this is not a
   * future-scheduled reminder, so it lives on its own track (see
   * `buildOngoingTimerNotifications` / `syncOngoingAsync`), not in
   * `buildNotifications`.
   */
  liveTimer: { enabled: boolean };
  /**
   * The ongoing, live-counting medication notification — for a **scheduled** dose
   * only, counting *down* to its clock time, drawn by the OS chronometer so it
   * ticks every second at no JS/battery cost. It appears only in the final
   * `LIVE_MED_LEAD_MS` before the dose and is dropped once due — never a negative
   * clock, never lingering. As-needed and 24h-cap meds get **no** live countdown
   * (they have no appointed time — just their fire-once "allowed again" alert). It
   * **supplements** the fire-once "due now" alert (which the user still wants).
   * Like `liveTimer`, this only materializes when the native chronometer module is
   * present (a dev/EAS build); on Expo Go/web it's a no-op and only the fire-once
   * alert remains. See `buildOngoingMedChronometers`.
   */
  liveMed: { enabled: boolean };
  weeklySummary: WeeklySummarySettings;
  perChild: Record<string, PerChildThresholds>;
}

// --- Output -----------------------------------------------------------------

/**
 * The buttons a delivered reminder offers. Chosen here, in the planner, rather
 * than by the native service: which buttons apply depends on the case *and* the
 * phase *and* which other offsets the user has enabled, all of which are in
 * scope here and none of which are recoverable from the notification key alone.
 * `src/notifications/service.ts` turns a set of these into an Android category.
 *
 *  - `ok`             — acknowledge; dismisses without opening the app.
 *  - `remind-later`   — postpone by `notificationStore.snoozeMinutes`.
 *  - `remind-on-time` — offered on a *before* reminder when the *at* offset is
 *                       switched off, so "shortly before" isn't the only warning.
 *  - `add-now`        — open the prefilled log-entry form.
 *  - `cancel-<type>`  — open the running timer's form with the discard confirmation.
 *  - `end-<type>`     — open the running timer's form to stop and save it.
 */
export type NotificationActionId =
  'ok' | 'remind-later' | 'remind-on-time' | 'add-now' | `cancel-${TimerType}` | `end-${TimerType}`;

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
  /** Action buttons to attach; absent/empty = a plain, button-less reminder. */
  actions?: NotificationActionId[];
  /**
   * Medication reminders only: the dose this reminder is about, so "add now"
   * opens a pre-filled repeat instead of a blank medication form — the same
   * thing tapping the dashboard's med row does. Absent on the 24h-limit case,
   * whose summaries carry no source entry.
   */
  prefillMedEntryId?: string;
  childId?: string;
}

export interface NotificationBuildInput {
  entries: Entry[];
  timers: RunningTimer[];
  children: Child[];
  settings: NotificationSettings;
  /** Signed-in caregiver's display name, for the weekly-summary "you" tally. */
  me?: string;
  /**
   * True when this plan was built from data we could **not** confirm against the
   * server (the pre-plan refetch failed — offline, VPN down, server restarting).
   * Every reminder is supposed to be server-validated before the user sees it; a
   * reminder we can't validate is still delivered rather than silently dropped
   * (dropping a medication reminder is the worse failure), but it says so in its
   * body. See `withDisclaimer`.
   */
  unverified?: boolean;
  /**
   * Children currently visible on the dashboard. **Only the weekly summary
   * respects this** — it recaps what the caregiver sees, so a hidden child (or a
   * hidden group) is left out of its counts. The reminder cases deliberately
   * ignore it: hiding a child from the dashboard is a display choice and must
   * not silently cancel that child's medication or feeding reminders.
   * Undefined means "no filtering".
   */
  visibleChildIds?: string[];
  /**
   * Kid grouping, for the weekly summary's per-group line. Undefined means "no
   * groups", which makes every child its own bucket — what the in-app sheet
   * shows for an account that never created a group.
   */
  kidGroups?: Pick<KidsVisibilityState, 'childGroupId' | 'groups'>;
  /**
   * Active "remind later" snoozes, keyed by the same `PlannedNotification.key`
   * the OS scheduled it under — set by the "remind later" notification action
   * (see `service.addActionListener`). A snoozed key's `fireAt` is postponed to
   * at least this timestamp; it never *brings forward* a reminder that would
   * naturally fire later. Entries the caller no longer considers active (past
   * their snooze time) should already be filtered out before calling — this
   * function doesn't expire them itself, it only ever compares against `now`
   * implicitly via the `fireAt > now` filter below.
   */
  snoozedUntil?: Record<string, number>;
  /**
   * Keys the user promoted with "remind me on time" — the map is keyed by the
   * **at-phase** key (`…:at`) they asked for, value = an epoch ms after which the
   * request is spent and can be pruned by the caller.
   *
   * Modeled here rather than as a one-off native reschedule because the next full
   * sync clears and re-schedules everything: a reminder the planner doesn't know
   * about would simply vanish. Presence of the key makes the `at` candidate be
   * emitted even though `timing.at` is off; see `expand`'s `forceAt`.
   */
  remindOnTime?: Record<string, number>;
}

/**
 * Mark a body as not-confirmed-with-the-server. **Idempotent** — the same body can
 * pass through here twice (planned while offline, then delivered while still
 * offline) and must not accumulate two disclaimers.
 */
export function withDisclaimer(body: string): string {
  // Render the template with an empty body to recover just the marker text, so the
  // already-marked check works in any locale — and whether the locale places the
  // disclaimer after the body (en) or anywhere else (an RTL sentence may not).
  const marker = i18n.t('notifications.unverified', { body: '' }).trim();
  if (marker && body.includes(marker)) return body;
  return i18n.t('notifications.unverified', { body });
}

type OffsetKind = 'before' | 'at' | 'after';

/**
 * Expand a timing spec around an anchor into its enabled fire points. `forceAt`
 * emits the "at" point even when the offset is switched off — the user asked for
 * it on this specific anchor via "remind me on time" (see `remindOnTime`).
 */
function expand(
  timing: TimingPrefs,
  anchor: number,
  forceAt = false,
): { kind: OffsetKind; fireAt: number }[] {
  const out: { kind: OffsetKind; fireAt: number }[] = [];
  // A zero lead/lag would collapse onto the "at" point — skip it rather than
  // emit two notifications at the same instant.
  if (timing.before && timing.beforeMinutes > 0)
    out.push({ kind: 'before', fireAt: anchor - timing.beforeMinutes * MINUTE });
  if (timing.at || forceAt) out.push({ kind: 'at', fireAt: anchor });
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

/**
 * Which buttons each phase of a medication reminder carries (issue #45).
 * The two conditionals are the whole point: "remind me on time" is only useful
 * when there *is* no on-time reminder coming, and "remind me later" would be
 * redundant on the "at" alert when an "after" one is already queued.
 */
function medActions(kind: OffsetKind, timing: TimingPrefs): NotificationActionId[] {
  if (kind === 'before') return timing.at ? ['ok'] : ['ok', 'remind-on-time'];
  if (kind === 'at') return timing.after ? ['add-now'] : ['add-now', 'remind-later'];
  return ['add-now', 'remind-later'];
}

/**
 * The feeding-gap equivalent. Same conditional rules, but the leading button is
 * "add now" rather than "ok" in every phase — a feed being due is always
 * actionable, where a dose that isn't due yet is only an acknowledgement.
 */
function foodActions(kind: OffsetKind, timing: TimingPrefs): NotificationActionId[] {
  if (kind === 'before') return timing.at ? ['add-now'] : ['add-now', 'remind-on-time'];
  if (kind === 'at') return timing.after ? ['add-now'] : ['add-now', 'remind-later'];
  return ['add-now', 'remind-later'];
}

/** The diaper case has no phases, so one fixed set. */
const DIAPER_ACTIONS: NotificationActionId[] = ['ok', 'add-now', 'remind-later'];

/** i18next appends `_noChild` when no child name resolved. */
function childContext(child: string | undefined) {
  return child ? undefined : 'noChild';
}

function medBody(
  kind: OffsetKind,
  med: string,
  child: string | undefined,
  minutes: number,
): string {
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

/**
 * Feeding-gap copy. The `at` phase keeps the original "hasn't been fed in
 * {{duration}}" wording, where the duration is the child's feeding interval;
 * before/after are relative to that deadline, like the medication bodies. The
 * `…Min` variants add the target amount when one is configured.
 */
function foodBody(
  kind: OffsetKind,
  child: string,
  intervalMinutes: number,
  offsetMinutes: number,
  minMl: number,
): string {
  const suffix = minMl > 0 ? 'Min' : '';
  const key =
    kind === 'at' ? `foodBody${suffix}` : `food${kind === 'before' ? 'Before' : 'After'}${suffix}`;
  return i18n.t(`notifications.${key}`, {
    child,
    duration: countdownLabel((kind === 'at' ? intervalMinutes : offsetMinutes) * MINUTE),
    min: minMl,
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
 * Every reminder the current data justifies, **unfiltered** — no future/horizon
 * cut and no ordering. `buildNotifications` filters this into the schedulable
 * plan; `validateNotification` (src/lib/notificationValidation.ts) re-derives it
 * from fresh server data to decide whether a notification about to be shown still
 * has a premise.
 *
 * Keeping validation on top of this one function is deliberate: a new reminder
 * case added here is validated automatically, whereas a hand-written per-case
 * validator would silently drift out of sync with the planner it guards.
 */
export function buildCandidates(
  input: NotificationBuildInput,
  now: number = Date.now(),
): PlannedNotification[] {
  const { entries, timers, children, settings, me, visibleChildIds, kidGroups } = input;
  if (!settings.masterEnabled) return [];

  const remindOnTime = input.remindOnTime ?? {};
  /** Did the user ask for this anchor's on-time reminder? (see `remindOnTime`) */
  const promoted = (stem: string) => remindOnTime[`${stem}:at`] != null;

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
      const stem = `sched:${childId ?? '?'}:${nameKey(s.name)}`;
      for (const { kind, fireAt } of expand(timing, s.dueAt, promoted(stem))) {
        out.push({
          key: `${stem}:${kind}`,
          fireAt,
          title: i18n.t('notifications.titleMedDue'),
          body: medBody(kind, s.name, who, minutesFor(kind, timing)),
          actions: medActions(kind, timing),
          prefillMedEntryId: s.entryId,
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
      const stem = `elig:${childId ?? '?'}:${nameKey(s.name)}`;
      for (const { kind, fireAt } of expand(timing, s.dueAt, promoted(stem))) {
        out.push({
          key: `${stem}:${kind}`,
          fireAt,
          title: i18n.t('notifications.titleMedReady'),
          body: eligibleBody(kind, s.name, who, minutesFor(kind, timing)),
          actions: medActions(kind, timing),
          prefillMedEntryId: s.entryId,
          childId,
        });
      }
    }

    for (const s of medLimitSummaries(entries, now)) {
      const who = childName.get(s.childId);
      const stem = `cap:${s.childId}:${nameKey(s.name)}`;
      for (const { kind, fireAt } of expand(timing, s.dueAt, promoted(stem))) {
        out.push({
          key: `${stem}:${kind}`,
          fireAt,
          title: i18n.t('notifications.titleMedReady'),
          body: eligibleBody(kind, s.name, who, minutesFor(kind, timing)),
          actions: medActions(kind, timing),
          childId: s.childId,
        });
      }
    }
  }

  // 3. Forgotten timers -----------------------------------------------------
  // Suppressed while the live running-timer notification is switched on: that
  // surface already sits in the tray showing the timer tick, so a second "did you
  // forget?" alert on top of it is noise (issue #45, "Other Notifications").
  // Keyed on the *setting*, not on whether the native chronometer module exists —
  // with the setting on, Expo Go still shows the minute-granular fallback track.
  if (settings.forgottenTimer.enabled && !settings.liveTimer.enabled) {
    const { thresholdMinutes, sleepThresholdMinutes } = settings.forgottenTimer;
    for (const rt of timers) {
      const who = childName.get(rt.childId);
      // Sleep gets its own (longer) threshold so a normal nap doesn't trip the
      // "forgotten timer" alert; every other type uses the general one.
      const effective = rt.type === 'sleep' ? sleepThresholdMinutes : thresholdMinutes;
      out.push({
        key: `timer:${rt.type}:${rt.childId}`,
        fireAt: rt.startedAt + effective * MINUTE,
        title: i18n.t('notifications.titleTimerRunning'),
        body: i18n.t('notifications.timerBody', {
          context: childContext(who),
          activity: i18n.t(`timer.typeLabel.${rt.type}`),
          child: who,
          duration: countdownLabel(effective * MINUTE),
        }),
        actions: [`cancel-${rt.type}`, `end-${rt.type}`],
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
        actions: DIAPER_ACTIONS,
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
    const timing = settings.foodMin.timing;
    for (const child of children) {
      const t = settings.perChild[child.id];
      const minutes = t?.foodMinIntervalMinutes ?? DEFAULT_FOOD_INTERVAL_MINUTES;
      if (minutes <= 0) continue;
      const last = lastEntryOfType(entries, child.id, 'feeding');
      if (last == null) continue;
      const minMl = t?.foodMinMl ?? 0;
      const stem = `food:${child.id}`;
      const anchor = last + minutes * MINUTE;
      for (const { kind, fireAt } of expand(timing, anchor, promoted(stem))) {
        out.push({
          key: `${stem}:${kind}`,
          fireAt,
          title: i18n.t('notifications.titleFoodDue'),
          body: foodBody(kind, child.name, minutes, minutesFor(kind, timing), minMl),
          actions: foodActions(kind, timing),
          childId: child.id,
        });
      }
    }
  }

  // 6. Weekly caregiver-contribution summary --------------------------------
  // Calendar-anchored (not data-anchored) and up to a week out, so it's built
  // and horizon-exempted separately below. The body is a trailing-7-day snapshot
  // computed now; with nothing logged all week there's nothing to recap, so it's
  // skipped — the same "no data → no reminder" rule the other cases follow.
  if (settings.weeklySummary.enabled && me) {
    // Scoped to the children the caregiver actually sees — the recap should
    // match what the in-app summary shows for the same week.
    const visibleSet = visibleChildIds == null ? null : new Set(visibleChildIds);
    const visible = visibleSet == null ? children : children.filter((c) => visibleSet.has(c.id));
    const weeklyEntries =
      visibleChildIds == null ? entries : entriesForChildren(entries, visibleChildIds);
    const summary = computeContribution(weeklyEntries, me, now);
    if (summary.allTotal > 0) {
      // Second line of the body, dropped by `contributionBody` when there's only
      // one bucket. With no `kidGroups` every child is its own bucket, which is
      // the same thing the sheet shows for an account with no groups.
      const buckets = computeGroupContributions(
        weeklyEntries,
        visible,
        kidGroups ?? { childGroupId: {}, groups: {} },
        me,
        now,
      );
      out.push({
        key: WEEKLY_KEY,
        fireAt: nextWeeklySlot(now, settings.weeklySummary.weekday, settings.weeklySummary.hour),
        title: i18n.t('notifications.titleWeekly'),
        body: contributionBody(summary, buckets),
      });
    }
  }

  return out;
}

/**
 * Drop the entries of a `key → epoch ms` map that have already elapsed. Shared by
 * `snoozedUntil` and `remindOnTime`, which the callers must filter before handing
 * them to the planner — an expired snooze would otherwise keep a reminder pinned
 * to a moment in the past, and a spent promotion would keep resurrecting an
 * on-time reminder the user asked for once, hours ago.
 *
 * Neither map is ever pruned in the store; filtering on read keeps the write path
 * (a notification action, which may run with the app half-asleep) trivial.
 */
export function activeDeferrals(
  map: Record<string, number>,
  now: number = Date.now(),
): Record<string, number> {
  return Object.fromEntries(Object.entries(map).filter(([, until]) => until > now));
}

/**
 * Build the full set of reminders that should currently be scheduled. Returns
 * strictly-future notifications within the planning horizon, soonest first, and
 * capped — a past `at`/`before` is silently dropped so an overdue dose only ever
 * surfaces through its "after" reminder.
 *
 * When `input.unverified` is set, every body carries the "couldn't confirm with
 * the server" disclaimer: these reminders were planned from cached data, and one
 * of them may fire while the app is closed, with no chance to re-check first.
 */
export function buildNotifications(
  input: NotificationBuildInput,
  now: number = Date.now(),
): PlannedNotification[] {
  const snoozed = input.snoozedUntil ?? {};
  const planned = buildCandidates(input, now)
    // A snooze only ever postpones — a key snoozed to a point *before* its
    // natural fireAt would otherwise pull the reminder earlier, which isn't
    // what "remind me later" means.
    .map((n) => {
      const until = snoozed[n.key];
      return until != null && until > n.fireAt ? { ...n, fireAt: until } : n;
    })
    .filter((n) => n.fireAt > now && (n.key === WEEKLY_KEY || n.fireAt <= now + HORIZON_MS))
    .sort((a, b) => a.fireAt - b.fireAt)
    .slice(0, MAX_PLANNED);
  if (!input.unverified) return planned;
  return planned.map((n) => ({ ...n, body: withDisclaimer(n.body) }));
}

/**
 * A persistent, presented-*now* notification — one per running timer — that sits
 * in the tray for as long as the timer runs. It has no `fireAt`: the OS shows it
 * immediately and keeps it (Android `setOngoing`), and the sync hook re-issues it
 * as the elapsed label changes. The native reconcile (`syncOngoingAsync`) diffs
 * this list against what's presented, so a stopped timer's notification clears.
 *
 * This is the **fallback** track, used when the native chronometer module is
 * absent (Expo Go / web): the elapsed label is baked into the body and is
 * minute-granular, refreshed by the hook's foreground/60s re-evaluation. When the
 * module *is* present, `buildOngoingTimerChronometers` supersedes this with a true
 * OS-drawn per-second clock (see `ChronometerSpec` / `src/notifications/chronometer.ts`).
 */
export interface OngoingNotification {
  /** `ongoing:${type}:${childId}` — the OS identifier, so re-issues update it. */
  key: string;
  title: string;
  body: string;
  childId?: string;
  /**
   * Action buttons, same as `ChronometerSpec.actions` — the minute-granular
   * fallback (Expo Go / any build without the native chronometer) attaches them
   * as an expo notification category so the two live-timer tracks behave alike.
   */
  actions?: NotificationActionId[];
}

/**
 * The ongoing notifications that should currently be presented — one per running
 * timer, or none when the case (or the master switch) is off. Pure; `now` feeds
 * the elapsed label so the caller controls the clock.
 */
export function buildOngoingTimerNotifications(
  input: Pick<NotificationBuildInput, 'timers' | 'children' | 'settings'>,
  now: number = Date.now(),
): OngoingNotification[] {
  const { timers, children, settings } = input;
  if (!settings.masterEnabled || !settings.liveTimer.enabled) return [];

  const childName = new Map(children.map((c) => [c.id, c.name]));
  return timers.map((rt) => {
    const who = childName.get(rt.childId);
    // Floor to whole minutes before formatting: countdownLabel rounds, so a raw
    // elapsed of 31s would render "1m" and the timer would appear to run ahead of
    // itself. Flooring keeps the label from ever overstating the elapsed time.
    const elapsedMinutes = Math.floor(Math.max(0, now - rt.startedAt) / MINUTE);
    return {
      key: `ongoing:${rt.type}:${rt.childId}`,
      title: i18n.t('notifications.liveTimerTitle', {
        activity: i18n.t(`timer.typeLabel.${rt.type}`),
      }),
      body: i18n.t('notifications.liveTimerBody', {
        context: childContext(who),
        child: who,
        duration: countdownLabel(elapsedMinutes * MINUTE),
      }),
      childId: rt.childId,
      actions: [`cancel-${rt.type}`, `end-${rt.type}`],
    };
  });
}

// --- Native chronometer notifications ---------------------------------------

/**
 * A live, OS-drawn chronometer notification. Unlike `OngoingNotification` (whose
 * elapsed label is baked into the body and only refreshes on the JS 60s tick),
 * this carries an `anchorMs` the Android notification chronometer ticks against
 * *itself*, every second, with no JS involvement — so it needs presenting only
 * **once** (and re-presenting only when the title/text/anchor changes, not to
 * advance the clock). It's the only true per-second surface in the managed
 * workflow, and materializes only when the local native module is installed
 * (`src/notifications/chronometer.ts`); everywhere else it's a no-op.
 */
export interface ChronometerSpec {
  /**
   * OS identifier / notification tag. Shares the `ongoing:` prefix family with
   * `OngoingNotification` so the same reconcile can dismiss stale ones:
   * `ongoing:${type}:${childId}` for timers, `ongoing-med:${childId}:${name}`
   * for meds.
   */
  key: string;
  title: string;
  /** Secondary line; the elapsed/remaining clock is drawn by the OS, not here. */
  text: string;
  /**
   * The chronometer's base, epoch ms. Timers pass `startedAt` and count up from
   * it; meds pass `dueAt` and count down toward it (then past it, into "overdue").
   */
  anchorMs: number;
  /** True → count down toward `anchorMs` (meds); false → count up (timers). */
  countDown: boolean;
  childId?: string;
  /**
   * Action buttons to attach, chosen by the same planner logic as the scheduled
   * reminders (`PlannedNotification.actions`). Running-timer chronometers carry
   * `cancel-<type>` / `end-<type>`; the medication countdown carries none (its
   * "before" phase is served by the fire-once scheduled reminder, which owns the
   * OK / remind-on-time buttons). The native module renders these under
   * `DecoratedCustomViewStyle` and routes a tap back through the very same
   * `useNotificationActions` handler the expo action buttons use.
   */
  actions?: NotificationActionId[];
}

/** Prefixes owned by the live-chronometer track, for reconcile/dismiss scoping. */
export const CHRONO_TIMER_PREFIX = 'ongoing:';
export const CHRONO_MED_PREFIX = 'ongoing-med:';

/**
 * How close to due a *scheduled* dose has to be before its live countdown
 * notification appears — the final quarter-hour. Short on purpose: the live
 * per-second clock is a "get ready, it's almost time" nudge, not a status
 * display. The countdown is only ever shown while the dose is still *upcoming*
 * (a true count-down to a future moment), so it never renders a negative clock
 * and never lingers past the dose; once due, the fire-once "due"/"overdue"
 * scheduled reminders (in `buildCandidates`) take over.
 */
const LIVE_MED_LEAD_MS = 15 * MINUTE;

/**
 * The live timer chronometers that should currently be presented — one per
 * running timer, counting up from its start. Parallels
 * `buildOngoingTimerNotifications` but for the native-chronometer track; the
 * caller picks one track or the other based on `chronometer.isSupported()`.
 */
export function buildOngoingTimerChronometers(
  input: Pick<NotificationBuildInput, 'timers' | 'children' | 'settings'>,
): ChronometerSpec[] {
  const { timers, children, settings } = input;
  if (!settings.masterEnabled || !settings.liveTimer.enabled) return [];

  const childName = new Map(children.map((c) => [c.id, c.name]));
  return timers.map((rt) => {
    const who = childName.get(rt.childId);
    return {
      key: `${CHRONO_TIMER_PREFIX}${rt.type}:${rt.childId}`,
      title: i18n.t('notifications.liveTimerTitle', {
        activity: i18n.t(`timer.typeLabel.${rt.type}`),
      }),
      // The OS draws the running clock; the text line just names who it's for.
      text: who ?? i18n.t('notifications.liveChronoRunning'),
      anchorMs: rt.startedAt,
      countDown: false,
      childId: rt.childId,
      // Same per-type timer buttons the forgotten-timer reminder carries, so
      // acting on a running timer is one tap from either surface.
      actions: [`cancel-${rt.type}`, `end-${rt.type}`],
    };
  });
}

/**
 * The live medication countdowns that should currently be presented — one per
 * **scheduled** dose whose next time is *upcoming*, within `LIVE_MED_LEAD_MS`.
 * Each counts down toward `dueAt` (always a future instant, so the clock is never
 * negative) and is dropped the moment the dose comes due — the reconcile
 * dismisses it, and the fire-once "due"/"overdue" scheduled reminders take over.
 *
 * **Scheduled meds only.** A live per-second countdown makes sense for a dose
 * with a fixed clock time; an *as-needed* medicine (`eligibleMeds`) or one gated
 * by a 24h dose cap (`medLimitSummaries`) has no appointed moment — it simply
 * becomes *allowed again*. Those still get their fire-once "you can give this
 * again" alert from `buildCandidates`, but not a ticking notification, which
 * would wrongly imply an imminent scheduled dose.
 *
 * Gated on `liveMed` (and the master switch). This is *additional* to the
 * fire-once "due now" scheduled reminder in `buildCandidates` — both can fire.
 */
export function buildOngoingMedChronometers(
  input: Pick<NotificationBuildInput, 'entries' | 'children' | 'settings'>,
  now: number = Date.now(),
): ChronometerSpec[] {
  const { entries, children, settings } = input;
  if (!settings.masterEnabled || !settings.liveMed.enabled) return [];

  const nameKey = (s: string) => s.trim().toLowerCase();
  // Upcoming only: strictly in the future (`> 0`, so the count-down clock stays
  // positive) and within the lead window. A dose that's already due drops out —
  // no negative clock, no ticking-since-given notification.
  const inWindow = (dueInMs: number) => dueInMs > 0 && dueInMs <= LIVE_MED_LEAD_MS;

  // One countdown per (child, medicine); a medicine listed twice for a child
  // collapses to the first.
  const byKey = new Map<string, ChronometerSpec>();

  // Per child, not over the merged list: `neededMeds` dedupes by medicine name
  // *globally*, so running it on all children at once would drop a second child's
  // same-named dose entirely. Scoping the source rows to one child first
  // preserves the one-countdown-per-(child, medicine) contract.
  for (const child of children) {
    const mine = entries.filter((e) => e.childId === child.id);
    for (const s of neededMeds(mine, now)) {
      if (!inWindow(s.dueInMs)) continue;
      const key = `${CHRONO_MED_PREFIX}${child.id}:${nameKey(s.name)}`;
      if (byKey.has(key)) continue;
      byKey.set(key, {
        key,
        title: i18n.t('notifications.titleMedDue'),
        text: i18n.t('notifications.liveMedBody', {
          context: childContext(child.name),
          med: s.name,
          child: child.name,
        }),
        anchorMs: s.dueAt,
        countDown: true,
        childId: child.id,
      });
    }
  }

  return [...byKey.values()];
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
