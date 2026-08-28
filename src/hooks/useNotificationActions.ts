/**
 * Reacts to Android notification-action taps. Mounted once, above the screens,
 * alongside `useNotificationSync`.
 *
 * The buttons themselves are chosen by the pure planner
 * (`PlannedNotification.actions`) and registered as categories by
 * `src/notifications/service.ts`; this is the other half — what each one *does*:
 *
 *  - `ok`             — nothing; the OS dismisses the notification on any action tap.
 *  - `remind-later`   — postpone the reminder by `snoozeMinutes`.
 *  - `remind-on-time` — offered on a *before* reminder when the "at" offset is off;
 *                       records a promotion so the planner emits that anchor's
 *                       on-time reminder anyway (see `remindOnTime`).
 *  - `add-now`        — open the prefilled log-entry form, as tapping the reminder
 *                       in the in-app carousel does (`notificationAction`).
 *  - `cancel-<type>`  — open the running timer's form with the discard confirmation.
 *  - `end-<type>`     — open the running timer's form to stop and save it; feeding
 *                       additionally opens the quantity prompt.
 *
 * A plain tap on the notification body (the SDK's default action identifier) is
 * deliberately left alone here — it keeps its existing behaviour of just opening
 * the app, with the in-app carousel as the place to act on it.
 */
import { useEffect } from 'react';
import * as service from '../notifications/service';
import { notificationAction } from '../lib/notifications';
import { useNotificationStore } from '../stores/notificationStore';
import { navigationRef } from '../navigation/navigationRef';
import { TIMER_TYPES, type TimerType } from '../lib/timers';

const MINUTE = 60_000;
/**
 * How long past the anchor a "remind me on time" promotion stays in the store.
 * Only needs to outlive the reminder it asked for; the planner cares about the
 * key being present, not the value, so this is purely when it can be pruned.
 */
const PROMOTION_GRACE_MS = 5 * MINUTE;

/**
 * The lead time (minutes) of the case a `…:before` key belongs to, so the
 * promotion can be given an expiry. Derived from the key prefix because the
 * three timing cases are configured independently.
 */
function beforeMinutesFor(key: string): number {
  const s = useNotificationStore.getState();
  if (key.startsWith('sched:')) return s.scheduledMeds.timing.beforeMinutes;
  if (key.startsWith('elig:') || key.startsWith('cap:'))
    return s.medEligibility.timing.beforeMinutes;
  if (key.startsWith('food:')) return s.foodMin.timing.beforeMinutes;
  return 0;
}

/** `cancel-sleep` / `end-tummyTime` → its two halves, or null for anything else. */
function parseTimerAction(action: string): { verb: 'cancel' | 'end'; type: TimerType } | null {
  const [verb, type] = action.split('-');
  if ((verb !== 'cancel' && verb !== 'end') || !type) return null;
  return (TIMER_TYPES as readonly string[]).includes(type)
    ? { verb, type: type as TimerType }
    : null;
}

function handleAction(event: service.NotificationActionEvent): void {
  const { actionIdentifier: action, id, childId } = event;

  if (action === service.ACTION_OK) return;

  if (action === service.ACTION_REMIND_LATER) {
    const minutes = useNotificationStore.getState().snoozeMinutes;
    useNotificationStore.getState().snoozeNotification(id, Date.now() + minutes * MINUTE);
    return;
  }

  if (action === service.ACTION_REMIND_ON_TIME) {
    // Only a "before" reminder ever carries this button, so the anchor is this
    // moment plus the case's lead time, and the on-time key is the same key with
    // its phase swapped. Promoting by key (rather than rescheduling natively)
    // survives the next full cancel-and-reschedule sync.
    if (!id.endsWith(':before')) return;
    const anchor = Date.now() + beforeMinutesFor(id) * MINUTE;
    useNotificationStore
      .getState()
      .promoteNotification(`${id.slice(0, -':before'.length)}:at`, anchor + PROMOTION_GRACE_MS);
    return;
  }

  if (!navigationRef.isReady()) return;

  const timer = parseTimerAction(action);
  if (timer) {
    if (!childId) return;
    navigationRef.navigate('LogEntry', {
      mode: 'create',
      childId,
      type: timer.type,
      // "cancel" discards the timer (with a confirmation), "end" stops and saves
      // it; feeding asks for the amount on the way, per the design.
      ...(timer.verb === 'cancel'
        ? ({ confirm: 'cancelTimer' } as const)
        : timer.type === 'feeding'
          ? ({ focus: 'amount' } as const)
          : {}),
    });
    return;
  }

  if (action !== service.ACTION_ADD_NOW && action !== service.ACTION_STOP_TIMER) return;
  if (!childId) return;

  const target = notificationAction(id);
  if (target.kind === 'timer') {
    // ACTION_STOP_TIMER is retired but can still be sitting in the tray on a
    // reminder scheduled by an earlier build; treat it as "end this timer".
    navigationRef.navigate('LogEntry', { mode: 'create', childId, type: target.timerType });
  } else if (target.kind === 'create') {
    navigationRef.navigate('LogEntry', { mode: 'create', childId, type: target.entryType });
  } else if (target.kind === 'medication') {
    navigationRef.navigate('LogEntry', {
      mode: 'create',
      childId,
      type: 'medication',
      // Absent on the 24h-limit case, which opens a blank medication form.
      prefillMedEntryId: event.prefillMedEntryId,
    });
  }
}

export function useNotificationActions(): void {
  useEffect(() => {
    // Cold start: the app may have just been launched by this very tap, in
    // which case the listener below — registered after this effect runs —
    // never sees it.
    void service.getLastActionAsync().then((event) => {
      if (event) handleAction(event);
    });
    return service.addActionListener(handleAction);
  }, []);
}
