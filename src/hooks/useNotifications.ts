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
 */
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useChildren, useEntries } from '../data/queries';
import { buildNotifications, buildOngoingTimerNotifications } from '../lib/notifications';
import { useNotificationStore } from '../stores';
import { useAuthStore } from '../stores/authStore';
import { useKidsStore } from '../stores/kidsStore';
import { useTimerStore } from '../stores/timerStore';
import { visibleChildren } from '../lib/visibility';
import * as service from '../notifications/service';

/** How often to re-evaluate while the app is foregrounded and enabled. */
const RESYNC_INTERVAL_MS = 60_000;

export function useNotificationSync(): void {
  const entries = useEntries().data;
  const children = useChildren().data;
  const timers = useTimerStore((s) => s.timers);

  const masterEnabled = useNotificationStore((s) => s.masterEnabled);
  const scheduledMeds = useNotificationStore((s) => s.scheduledMeds);
  const medEligibility = useNotificationStore((s) => s.medEligibility);
  const forgottenTimer = useNotificationStore((s) => s.forgottenTimer);
  const diaperInterval = useNotificationStore((s) => s.diaperInterval);
  const foodMin = useNotificationStore((s) => s.foodMin);
  const liveTimer = useNotificationStore((s) => s.liveTimer);
  const weeklySummary = useNotificationStore((s) => s.weeklySummary);
  const perChild = useNotificationStore((s) => s.perChild);
  const setPermissionStatus = useNotificationStore((s) => s.setPermissionStatus);
  const me = useAuthStore((s) => s.session?.userName);

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
      settings: {
        masterEnabled,
        scheduledMeds,
        medEligibility,
        forgottenTimer,
        diaperInterval,
        foodMin,
        liveTimer,
        weeklySummary,
        perChild,
      },
      me,
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
    masterEnabled,
    scheduledMeds,
    medEligibility,
    forgottenTimer,
    diaperInterval,
    foodMin,
    liveTimer,
    weeklySummary,
    perChild,
    me,
    hidden,
    childGroupId,
    groups,
    childSchedule,
    tick,
  ]);

  // Ongoing running-timer notifications live on their own track: they're
  // presented *now* (not future-scheduled), so they can't share the plan above.
  // The body carries a minute-granular elapsed label, which is why this rebuilds
  // on the same foreground/60s `tick` — each minute it re-issues with fresh text.
  const lastOngoingSig = useRef<string>('');
  useEffect(() => {
    const ongoing = buildOngoingTimerNotifications({
      timers,
      children: children ?? [],
      settings: {
        masterEnabled,
        liveTimer,
        // The rest are unread by the ongoing builder but required by the type.
        scheduledMeds,
        medEligibility,
        forgottenTimer,
        diaperInterval,
        foodMin,
        weeklySummary,
        perChild,
      },
    });
    const sig = JSON.stringify(ongoing.map((o) => [o.key, o.title, o.body]));
    if (sig === lastOngoingSig.current) return;
    lastOngoingSig.current = sig;
    void service.syncOngoingAsync(ongoing);
  }, [
    children,
    timers,
    masterEnabled,
    liveTimer,
    scheduledMeds,
    medEligibility,
    forgottenTimer,
    diaperInterval,
    foodMin,
    weeklySummary,
    perChild,
    tick,
  ]);
}
