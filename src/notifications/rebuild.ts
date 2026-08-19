/**
 * The **headless** "refetch → build the scheduled plan → hand it to the OS" path,
 * used by the background task (`backgroundTask.ts`), which has no React tree and so
 * can't use `useNotificationSync`'s subscriptions.
 *
 * It reads live state imperatively from the stores + the shared query cache (never
 * from render), exactly the way `validateFromCache` in `useNotificationValidator`
 * already does, and assembles the same inputs the foreground hook feeds
 * `buildNotifications` — raw store timers included — so a plan built in the
 * background is identical to the one the foreground would build for the same data.
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
import { buildNotifications } from '../lib/notifications';
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
  // Nothing to schedule — make sure the OS holds nothing stale, then stop.
  if (!settings.masterEnabled) {
    await service.syncScheduledAsync([]);
    return false;
  }

  // Plan-time validation: never build from cache we haven't confirmed. On failure
  // we still build (offline must not silently mean "no reminders"), but flag the
  // plan `unverified` so each body carries the "couldn't confirm" caveat.
  const confirmed = await refreshServerData(queryClient);

  const entries = queryClient.getQueryData<Entry[]>(queryKeys.entries) ?? [];
  const children = queryClient.getQueryData<Child[]>(queryKeys.children) ?? [];
  // Raw store timers, matching what the foreground `useNotificationSync` feeds
  // `buildNotifications` — so a plan built in the background is identical to the
  // one the foreground would build. (Delivery-time validation still reconciles
  // against the server, which is stricter; that's by design.)
  const timers = useTimerStore.getState().timers;

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

  const plan = buildNotifications({
    entries,
    timers,
    children,
    visibleChildIds: visible.map((c) => c.id),
    kidGroups: { childGroupId: kids.childGroupId, groups: kids.groups },
    settings,
    me: useAuthStore.getState().session?.userName,
    unverified: !confirmed,
  });
  await service.syncScheduledAsync(plan);
  return confirmed;
}
