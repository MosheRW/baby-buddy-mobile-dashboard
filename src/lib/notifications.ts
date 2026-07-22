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
 * The three MVP cases are wired here. Diaper-interval and food-min are deferred;
 * add them as further branches without changing this shape.
 */
import i18n from '../i18n';
import type { Child, Entry } from '../api/types';
import { eligibleMeds, medLimitSummaries, neededMeds, countdownLabel } from './medication';
import type { RunningTimer } from './timers';

const MINUTE = 60_000;
/** Don't schedule further out than this — the plan is rebuilt on every refresh. */
const HORIZON_MS = 48 * 60 * MINUTE;
/** OS-scheduled-notification budgets are finite; keep the list bounded. */
const MAX_PLANNED = 64;

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

/** The subset of notification settings the builder reads. */
export interface NotificationSettings {
  masterEnabled: boolean;
  scheduledMeds: CaseSettings;
  medEligibility: CaseSettings;
  forgottenTimer: { enabled: boolean; thresholdMinutes: number };
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
 * Build the full set of reminders that should currently be scheduled. Returns
 * strictly-future notifications within the planning horizon, soonest first, and
 * capped — a past `at`/`before` is silently dropped so an overdue dose only ever
 * surfaces through its "after" reminder.
 */
export function buildNotifications(
  input: NotificationBuildInput,
  now: number = Date.now(),
): PlannedNotification[] {
  const { entries, timers, children, settings } = input;
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

  return out
    .filter((n) => n.fireAt > now && n.fireAt <= now + HORIZON_MS)
    .sort((a, b) => a.fireAt - b.fireAt)
    .slice(0, MAX_PLANNED);
}
