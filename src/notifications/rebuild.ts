/**
 * The **headless** "refetch → build the scheduled plan → hand it to the OS" path,
 * used by the background task (`backgroundTask.ts`), which has no React tree and so
 * can't use `useNotificationSync`'s subscriptions.
 *
 * It reads live state imperatively from the stores + the shared query cache (never
 * from render), exactly the way `validateFromCache` in `useNotificationValidator`
 * already does, and assembles the same inputs the foreground hook feeds
 * `buildNotifications` — including timers reconciled against the freshly-fetched
 * server list (the merge `useTimerSync` runs continuously in the foreground, which
 * has no React tree to run it here) — so a plan built in the background reflects
 * the same server-fresh data the foreground would build for.
 *
 * The foreground hook deliberately does **not** route through here: it already
 * refetches on its own tick and diffs the plan (`lastSig`) to avoid re-issuing
 * identical schedules every 60s, neither of which this self-contained function
 * does. The shared source of truth for *what* gets scheduled is `buildNotifications`
 * / `buildCandidates`, which both paths call — the only thing repeated here is the
 * trivial input glue, the same split the hook/validator pair already lives with.
 */
import type { Child, Entry } from '../api/types';
import { queryClient } from '../data/queryClient';
import { queryKeys, refreshServerData } from '../data/queries';
import { activeDeferrals, buildNotifications } from '../lib/notifications';
import { reconcileTimers, type RunningTimer } from '../lib/timers';
import { visibleChildren } from '../lib/visibility';
import { useAuthStore } from '../stores/authStore';
import { useKidsStore } from '../stores/kidsStore';
import { selectNotificationSettings, useNotificationStore } from '../stores/notificationStore';
import { useTimerStore } from '../stores/timerStore';
import * as service from './service';

/**
 * Refetch the server, rebuild the scheduled notification plan from the freshest
 * data, and reconcile it onto the OS scheduler.
 *
 * Safe to call from anywhere at any time: it clears the plan and returns early when
 * the master switch is off or nobody is signed in, and every dependency degrades to
 * a no-op where notifications are unsupported (web/Expo Go). Returns whether the
 * server confirmed the data — the caller can use it, but it never throws.
 */
export async function runScheduledNotificationSync(): Promise<boolean> {
  const settings = selectNotificationSettings(useNotificationStore.getState());
  // Nothing to schedule — make sure the OS holds nothing stale, then stop. Two
  // ways to get here: the master switch is off, or nobody is signed in. The
  // signed-out case matters on this headless path specifically: without a session
  // there's no authenticated server to refetch from, so a rebuild would schedule
  // reminders from whatever the query cache and local timer store were last left
  // holding — exactly the stale data this feature exists to avoid.
  if (!settings.masterEnabled || useAuthStore.getState().session === null) {
    await service.syncScheduledAsync([]);
    return false;
  }

  // Plan-time validation: never build from cache we haven't confirmed. On failure
  // we still build (offline must not silently mean "no reminders"), but flag the
  // plan `unverified` so each body carries the "couldn't confirm" caveat.
  const confirmed = await refreshServerData(queryClient);

  const entries = queryClient.getQueryData<Entry[]>(queryKeys.entries) ?? [];
  const children = queryClient.getQueryData<Child[]>(queryKeys.children) ?? [];
  // Reconcile the persisted local timers against the timers we just refetched.
  // In the foreground this happens continuously in `useTimerSync`, so the store
  // the planner reads there is already server-fresh; on this headless path no
  // React effect runs, so the freshly-fetched list sits in the query cache and
  // the store still reflects the last foreground reconcile. Folding them here —
  // the same merge `useTimerSync` performs — is what lets a forgotten-timer
  // reminder drop when another caregiver stopped that timer elsewhere, which is
  // precisely the dead-window case this background refresh targets. A failed
  // refetch leaves the last-known server list in cache, so this degrades to the
  // same staleness the foreground already accepts rather than dropping timers.
  const { timers: localTimers, stopping } = useTimerStore.getState();
  const serverTimers = queryClient.getQueryData<RunningTimer[]>(queryKeys.timers) ?? [];
  const timers = reconcileTimers(localTimers, serverTimers, stopping);

  // Visibility (only the weekly summary reads it). Reveal is deliberately not
  // applied — a shake-to-peek shouldn't widen the week's recap.
  const kids = useKidsStore.getState();
  const visible = visibleChildren(
    children,
    {
      hidden: kids.hidden,
      childGroupId: kids.childGroupId,
      groups: kids.groups,
      childSchedule: kids.childSchedule,
    },
    Date.now(),
    false,
  );

  // The same two deferral maps the foreground rebuild folds in. Without them a
  // background rebuild would quietly undo a "remind later" or a "remind me on
  // time" the user tapped, since it re-schedules the whole plan from scratch.
  const notif = useNotificationStore.getState();
  const plan = buildNotifications({
    entries,
    timers,
    children,
    snoozedUntil: activeDeferrals(notif.snoozedUntil),
    remindOnTime: activeDeferrals(notif.remindOnTime),
    visibleChildIds: visible.map((c) => c.id),
    kidGroups: { childGroupId: kids.childGroupId, groups: kids.groups },
    settings,
    me: useAuthStore.getState().session?.userName,
    unverified: !confirmed,
  });
  await service.syncScheduledAsync(plan);
  return confirmed;
}
