/**
 * Bridges the notification settings + current data to the OS scheduler.
 *
 * Mounted once, above the screens (in `RootNavigator`). It rebuilds the plan
 * from the freshest entries/timers/children/settings and hands it to the native
 * service, which reconciles what the OS has scheduled. Because every reminder is
 * an absolute future timestamp, the plan is recomputed — not just on data change
 * — on app foreground and on a slow interval, so a timer crossing its threshold
 * or a dose newly falling inside the horizon gets scheduled without a manual
 * refresh.
 *
 * **No reminder reaches the user on a premise the server no longer backs.** Baby
 * Buddy is multi-caregiver, so cached data goes wrong without us doing anything —
 * another parent logs the change and our "diaper check" is a lie. Two gates:
 *
 *  1. *Plan time* — the rebuild refetches from the server first
 *     (`refreshServerData`) instead of trusting React Query's cache. If that fetch
 *     fails, the plan is still built (offline must not mean no reminders) but every
 *     body carries the `withDisclaimer` caveat, because one of those may fire while
 *     the app is dead, where nothing can re-check it.
 *  2. *Delivery time* — `setDeliveryValidator` gives the native service a gate that
 *     re-fetches and re-derives the reminder as it arrives, suppressing it if the
 *     premise is gone. Foreground only; see the note on `setDeliveryValidator`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { refreshServerData, useChildren, useEntries } from '../data/queries';
import {
  buildNotifications,
  buildOngoingTimerNotifications,
  withDisclaimer,
  type NotificationSettings,
} from '../lib/notifications';
import { useNotificationStore } from '../stores';
import { useAuthStore } from '../stores/authStore';
import { useKidsStore } from '../stores/kidsStore';
import { useTimerStore } from '../stores/timerStore';
import { visibleChildren } from '../lib/visibility';
import * as service from '../notifications/service';
import {
  getBackgroundStatusAsync,
  registerBackgroundTaskAsync,
  unregisterBackgroundTaskAsync,
} from '../notifications/backgroundTask';
import { useNotificationValidator } from './useNotificationValidator';

/** How often to re-evaluate while the app is foregrounded and enabled. */
const RESYNC_INTERVAL_MS = 60_000;

export function useNotificationSync(): void {
  const entries = useEntries().data;
  const children = useChildren().data;
  const timers = useTimerStore((s) => s.timers);
  const queryClient = useQueryClient();
  const validate = useNotificationValidator();

  const masterEnabled = useNotificationStore((s) => s.masterEnabled);
  const scheduledMeds = useNotificationStore((s) => s.scheduledMeds);
  const medEligibility = useNotificationStore((s) => s.medEligibility);
  const forgottenTimer = useNotificationStore((s) => s.forgottenTimer);
  const diaperInterval = useNotificationStore((s) => s.diaperInterval);
  const foodMin = useNotificationStore((s) => s.foodMin);
  const liveTimer = useNotificationStore((s) => s.liveTimer);
  const weeklySummary = useNotificationStore((s) => s.weeklySummary);
  const perChild = useNotificationStore((s) => s.perChild);
  const backgroundRefresh = useNotificationStore((s) => s.backgroundRefresh.enabled);
  const setPermissionStatus = useNotificationStore((s) => s.setPermissionStatus);
  const setBackgroundStatus = useNotificationStore((s) => s.setBackgroundStatus);
  const me = useAuthStore((s) => s.session?.userName);

  // One settings object, memoized on the individual store slices and shared by the
  // scheduled plan, the ongoing-timer plan and the delivery validator — the three
  // must agree on what's enabled or a reminder could be planned and then rejected
  // at the gate (or vice versa).
  const settings: NotificationSettings = useMemo(
    () => ({
      masterEnabled,
      scheduledMeds,
      medEligibility,
      forgottenTimer,
      diaperInterval,
      foodMin,
      liveTimer,
      weeklySummary,
      perChild,
    }),
    [
      masterEnabled,
      scheduledMeds,
      medEligibility,
      forgottenTimer,
      diaperInterval,
      foodMin,
      liveTimer,
      weeklySummary,
      perChild,
    ],
  );

  // Visibility slices, subscribed individually so the plan doesn't rebuild on
  // every unrelated kids-store change. Only the weekly summary reads them.
  const hidden = useKidsStore((s) => s.hidden);
  const childGroupId = useKidsStore((s) => s.childGroupId);
  const groups = useKidsStore((s) => s.groups);
  const childSchedule = useKidsStore((s) => s.childSchedule);

  const [tick, setTick] = useState(0);

  // Register handler/channel and reflect the live OS permission state once.
  useEffect(() => {
    void service.initAsync();
    void service.getPermissionStatusAsync().then(setPermissionStatus);
  }, [setPermissionStatus]);

  // Opt-in background refresh: register the WorkManager task while enabled (and the
  // master switch is on), unregister otherwise. `getBackgroundStatusAsync` reflects
  // whether the OS will actually run it (battery optimization can restrict it), so
  // the settings screen can warn the user. No-op on web/Expo Go.
  useEffect(() => {
    let cancelled = false;
    if (masterEnabled && backgroundRefresh) {
      void registerBackgroundTaskAsync()
        .then(getBackgroundStatusAsync)
        .then((status) => {
          if (!cancelled) setBackgroundStatus(status);
        });
    } else {
      void unregisterBackgroundTaskAsync();
      // Reading status while disabled still tells us if the capability exists at
      // all (unsupported vs available), which the UI uses to hide/show the note.
      void getBackgroundStatusAsync().then((status) => {
        if (!cancelled) setBackgroundStatus(status);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [masterEnabled, backgroundRefresh, setBackgroundStatus]);

  // Re-evaluate on foreground and on a slow interval, but only while enabled.
  useEffect(() => {
    if (!masterEnabled) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setTick((t) => t + 1);
    });
    const id = setInterval(() => setTick((t) => t + 1), RESYNC_INTERVAL_MS);
    return () => {
      sub.remove();
      clearInterval(id);
    };
  }, [masterEnabled]);

  // Plan-time validation: pull fresh data from the server before each rebuild, and
  // record whether it answered. `null` = nothing confirmed yet this launch, which
  // counts as unverified — the plan built on mount comes from the persisted cache.
  // Runs on the same tick as the rebuild, so every plan is at most one tick behind
  // the server rather than however stale React Query's cache happens to be.
  const [serverConfirmed, setServerConfirmed] = useState<boolean | null>(null);
  useEffect(() => {
    if (!masterEnabled) return;
    // Foreground only. The tick's interval keeps firing while backgrounded (Android
    // leaves the JS context alive for a while), and a per-minute fan-out across seven
    // endpoints behind the user's back is real battery and data. It costs no freshness
    // either: with no refetch, none of the planner's inputs change while backgrounded,
    // so a background tick rebuilds the same plan already validated at the last
    // foreground — and the AppState listener above bumps `tick` the instant we return.
    if (AppState.currentState !== 'active') return;
    let cancelled = false;
    void refreshServerData(queryClient).then((ok) => {
      // Same-value updates are skipped so the steady state doesn't re-render every
      // minute purely to say "still reachable".
      if (!cancelled) setServerConfirmed((prev) => (prev === ok ? prev : ok));
    });
    return () => {
      cancelled = true;
    };
  }, [masterEnabled, queryClient, tick]);

  // Rebuild and push to the OS whenever the plan actually changes. The signature
  // check keeps the interval/foreground ticks from re-issuing identical schedules.
  const lastSig = useRef<string>('');
  useEffect(() => {
    // Reveal is deliberately not applied: a shake-to-peek shouldn't widen the
    // week's recap. Recomputed here rather than memoized because a schedule
    // window can open or close between ticks.
    const visible = visibleChildren(
      children ?? [],
      { hidden, childGroupId, groups, childSchedule },
      Date.now(),
      false,
    );
    const plan = buildNotifications({
      entries: entries ?? [],
      timers,
      children: children ?? [],
      visibleChildIds: visible.map((c) => c.id),
      kidGroups: { childGroupId, groups },
      settings,
      me,
      // Anything planned without a confirmed fetch is disclaimed: it may fire with
      // the app dead, where the delivery gate can't run.
      unverified: serverConfirmed !== true,
    });
    // Body is part of the signature so the weekly summary re-syncs when its
    // trailing-week counts change — its fireAt stays fixed all week, but the
    // recap it will deliver must reflect the latest data each time the app opens.
    // The other cases have fireAt-stable bodies, so this adds no churn for them.
    const sig = JSON.stringify(plan.map((p) => [p.key, p.fireAt, p.body]));
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    void service.syncScheduledAsync(plan);
  }, [
    entries,
    children,
    timers,
    settings,
    me,
    serverConfirmed,
    hidden,
    childGroupId,
    groups,
    childSchedule,
    tick,
  ]);

  // Delivery-time validation: hand the native service a gate it can call as each
  // reminder arrives. Registered once — the validator reads live state at call time,
  // so it never needs re-registering (and a closure over this render's values would
  // be stale by the time a reminder actually fires).
  useEffect(() => {
    service.setDeliveryValidator(async ({ id, body }) => {
      const { verdict, body: fresh } = await validate(id, body);
      // Fail open: show it, but say we couldn't confirm it. Suppressing here would
      // silently swallow a medication reminder whenever the server is unreachable.
      if (verdict === 'unknown') return { show: true, body: withDisclaimer(body) };
      if (verdict === 'stale') return { show: false };
      // `fresh` also clears a disclaimer baked in at plan time — this delivery *was*
      // confirmed, so the caveat no longer applies.
      return { show: true, body: fresh };
    });
    return () => service.setDeliveryValidator(null);
  }, [validate]);

  // Ongoing running-timer notifications live on their own track: they're
  // presented *now* (not future-scheduled), so they can't share the plan above.
  // The body carries a minute-granular elapsed label, which is why this rebuilds
  // on the same foreground/60s `tick` — each minute it re-issues with fresh text.
  const lastOngoingSig = useRef<string>('');
  useEffect(() => {
    const ongoing = buildOngoingTimerNotifications({
      timers,
      children: children ?? [],
      settings,
    });
    const sig = JSON.stringify(ongoing.map((o) => [o.key, o.title, o.body]));
    if (sig === lastOngoingSig.current) return;
    lastOngoingSig.current = sig;
    void service.syncOngoingAsync(ongoing);
  }, [children, timers, settings, tick]);
}
