/**
 * The one place a notification is checked against the server before the user sees
 * it. Two callers, two surfaces:
 *
 *  - `useNotificationSync` registers it as the native delivery gate, so a reminder
 *    arriving while the app is foregrounded is suppressed if its premise is gone.
 *  - `useDeliveredNotifications` runs it over the tray on open, which is the only
 *    chance to catch reminders that fired while the app was dead — no JS ran then,
 *    so those reached the user unvalidated.
 *
 * Live inputs are read imperatively from the stores (`getState()`) rather than
 * captured from render, the same way `dataSource` reads the session: this runs on
 * OS delivery, arbitrarily long after the render that registered it, and a closure
 * over render-time values would be validating against yesterday's settings.
 */
import { useCallback } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { Child, Entry } from '../api/types';
import { queryKeys, refreshServerData } from '../data/queries';
import { validateNotification, type NotificationVerdict } from '../lib/notificationValidation';
import { activeDeferrals } from '../lib/notifications';
import { reconcileTimers, type RunningTimer } from '../lib/timers';
import { selectNotificationSettings, useNotificationStore } from '../stores/notificationStore';
import { useAuthStore } from '../stores/authStore';
import { useTimerStore } from '../stores/timerStore';

export interface LiveValidation {
  verdict: NotificationVerdict;
  /** Body rebuilt from fresh data; undefined = the scheduled body still stands. */
  body?: string;
}

export interface ValidateOptions {
  /**
   * Skip the server refetch and validate against what's already cached. For a
   * caller validating a batch, which refreshes once itself rather than per item.
   */
  skipRefresh?: boolean;
}

export type ValidateNotificationFn = (
  id: string,
  body: string,
  options?: ValidateOptions,
) => Promise<LiveValidation>;

/** Validate against whatever is currently in the query cache. */
function validateFromCache(client: QueryClient, id: string, body: string): LiveValidation {
  const timerState = useTimerStore.getState();
  const notifState = useNotificationStore.getState();
  return validateNotification({
    key: id,
    body,
    entries: client.getQueryData<Entry[]>(queryKeys.entries) ?? [],
    children: client.getQueryData<Child[]>(queryKeys.children) ?? [],
    // The same merge the dashboard uses: a local timer whose server id the server
    // no longer lists (another caregiver stopped it) drops out — which is precisely
    // what makes its forgotten-timer reminder stale.
    timers: reconcileTimers(
      timerState.timers,
      client.getQueryData<RunningTimer[]>(queryKeys.timers) ?? [],
      timerState.stopping,
    ),
    settings: selectNotificationSettings(notifState),
    // `remindOnTime` *adds* a candidate (an on-time reminder for an anchor whose
    // "at" offset is switched off), so leaving it out here would make every
    // promoted reminder validate as `stale` and get suppressed the moment it
    // arrives. `snoozedUntil` needs no such care — it only shifts a candidate's
    // fireAt, and `buildCandidates` doesn't apply it at all.
    remindOnTime: activeDeferrals(notifState.remindOnTime),
    me: useAuthStore.getState().session?.userName,
  });
}

export function useNotificationValidator(): ValidateNotificationFn {
  const queryClient = useQueryClient();

  return useCallback(
    async (id, body, options) => {
      if (!options?.skipRefresh) {
        const confirmed = await refreshServerData(queryClient);
        // Couldn't reach the server, so we can neither confirm nor refute. The
        // caller decides what to do with that; nothing is silently dropped on it.
        if (!confirmed) return { verdict: 'unknown' };
      }
      return validateFromCache(queryClient, id, body);
    },
    [queryClient],
  );
}

/**
 * Refresh once for a batch, so validating N tray notifications doesn't fire N
 * rounds of requests. Returns whether the server answered; on `false` the caller
 * should treat every item as `unknown`.
 */
export function useNotificationRefresh(): () => Promise<boolean> {
  const queryClient = useQueryClient();
  return useCallback(() => refreshServerData(queryClient), [queryClient]);
}
