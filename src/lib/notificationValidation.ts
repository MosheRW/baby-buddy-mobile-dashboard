/**
 * Server-validation of a notification that is about to be shown — pure, and like
 * the planner it guards, free of any `expo-notifications` import.
 *
 * Why this exists: reminders are *locally pre-scheduled* absolute timestamps, so
 * one can be handed to the OS minutes or hours before it fires, from data that was
 * true at the time. Baby Buddy is multi-caregiver — another parent logs the diaper
 * change on the server and our "diaper check" reminder is now about to tell a lie.
 * The rule is that nothing reaches the user unless the server still backs it.
 *
 * The check is deliberately *not* a per-case hand-written rule set. It re-derives
 * the whole candidate list from fresh server data (`buildCandidates`) and asks two
 * questions about the key that's firing:
 *
 *   1. Is it still there at all?  A stopped timer, a med no longer due, a child
 *      that vanished → the key is simply absent → `stale`.
 *   2. Has its anchor moved into the future?  A diaper logged 5 minutes ago pushes
 *      `last + interval` well past now → the deadline hasn't arrived → `stale`.
 *
 * Anything else is `valid`, and the candidate's freshly-built body comes back with
 * it so the copy delivered reflects the server, not the cache.
 */
import { buildCandidates, WEEKLY_KEY, type NotificationBuildInput } from './notifications';

/**
 * `valid` / `stale` are decided here from fresh data. `unknown` is the *caller's*
 * verdict when it couldn't reach the server at all — this function never returns
 * it. An `unknown` notification is still shown (dropping a medication reminder is
 * the worse failure) but carries the `withDisclaimer` body.
 */
export type NotificationVerdict = 'valid' | 'stale' | 'unknown';

export interface NotificationValidationResult {
  verdict: NotificationVerdict;
  /**
   * The body the notification should be shown with, rebuilt from fresh data. Only
   * set when it differs from the scheduled body — so `undefined` means "show it as
   * scheduled". Note this also *removes* a stale disclaimer: a reminder planned
   * while offline gets a clean body once the server confirms it.
   */
  body?: string;
}

export interface NotificationValidationInput extends NotificationBuildInput {
  /** OS identifier of the notification firing — equal to `PlannedNotification.key`. */
  key: string;
  /** Body it was scheduled with, to detect drift. Omit to skip the body compare. */
  body?: string;
}

/**
 * Slack on the "anchor moved into the future" test, absorbing scheduler jitter and
 * the second or two between the OS firing and our fetch completing. Sized so that
 * only a *genuine* data change (which moves a deadline by minutes at minimum —
 * intervals are minutes-to-hours) reads as stale.
 */
const TOLERANCE_MS = 60_000;

/**
 * Decide whether `input.key` still deserves to be shown, given freshly-fetched
 * server data. `now` is injected so the caller (and tests) control the clock.
 */
export function validateNotification(
  input: NotificationValidationInput,
  now: number = Date.now(),
): NotificationValidationResult {
  const { key } = input;

  // The running-timer notifications aren't scheduled reminders — we present them
  // ourselves each minute from live state, so there is no staleness to check and
  // no plan entry to find. Never suppress one.
  if (key.startsWith('ongoing:')) return { verdict: 'valid' };

  // Notifications switched off since this was scheduled. The OS still holds
  // whatever we scheduled before the user flipped the switch.
  if (!input.settings.masterEnabled) return { verdict: 'stale' };

  const match = buildCandidates(input, now).find((c) => c.key === key);
  if (!match) return { verdict: 'stale' };

  // The weekly recap is calendar-anchored, not data-anchored: at the instant it
  // fires, `nextWeeklySlot` has already rolled to *next* week, so the fireAt test
  // below would call every weekly summary stale. Its data can't go stale either —
  // it's a report on a window that has closed — but its numbers should be the
  // freshest available, which is what the rebuilt body gives it.
  if (key !== WEEKLY_KEY && match.fireAt > now + TOLERANCE_MS) return { verdict: 'stale' };

  return {
    verdict: 'valid',
    body: input.body != null && match.body !== input.body ? match.body : undefined,
  };
}
