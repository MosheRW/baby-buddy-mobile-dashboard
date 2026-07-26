/**
 * Reads the reminders the OS has already *delivered* (sitting in the tray) so the
 * dashboard can surface them in an in-app carousel above the child card.
 *
 * These only exist on a real build — the native service no-ops on web / Expo Go,
 * so `items` is simply empty there and the carousel stays hidden. The list is
 * refreshed on mount, whenever the app returns to the foreground, whenever a
 * reminder fires while foregrounded (the received listener), and on a slow
 * interval as a safety net for tray dismissals the OS doesn't tell us about.
 *
 * Gated on `masterEnabled`: with notifications off nothing is scheduled and
 * nothing can be in the tray, so we skip the native reads entirely.
 *
 * **Every item is re-validated against the server before it's shown.** This is the
 * one place a reminder that fired while the app was *dead* can be caught: no JS ran
 * then, so the delivery gate never saw it, and by the time the app opens another
 * caregiver may have made it false. A stale one is dropped from the carousel *and*
 * dismissed from the tray, since it isn't true there either.
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useNotificationStore } from '../stores';
import * as service from '../notifications/service';
import type { DeliveredNotification } from '../notifications/service';
import { withDisclaimer } from '../lib/notifications';
import { useNotificationRefresh, useNotificationValidator } from './useNotificationValidator';

export type { DeliveredNotification } from '../notifications/service';

/** Safety-net poll for tray dismissals that fire no in-app event. */
const REFRESH_INTERVAL_MS = 30_000;

export interface DeliveredNotifications {
  items: DeliveredNotification[];
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

export function useDeliveredNotifications(): DeliveredNotifications {
  const masterEnabled = useNotificationStore((s) => s.masterEnabled);
  const [items, setItems] = useState<DeliveredNotification[]>([]);
  const validate = useNotificationValidator();
  const refresh = useNotificationRefresh();

  /**
   * Drop the tray items the server no longer backs, and refresh the copy of the
   * ones it does. One refetch for the whole batch (`skipRefresh` on each item), so
   * a tray with five reminders doesn't fire five rounds of requests.
   */
  const validateAll = useCallback(
    async (delivered: DeliveredNotification[]): Promise<DeliveredNotification[]> => {
      if (delivered.length === 0) return delivered;
      const confirmed = await refresh();
      // Offline: keep everything — the same fail-open rule the delivery gate uses —
      // but mark the copy, since we can't stand behind it.
      if (!confirmed) return delivered.map((n) => ({ ...n, body: withDisclaimer(n.body) }));

      const checked = await Promise.all(
        delivered.map(async (n) => {
          const { verdict, body } = await validate(n.id, n.body, { skipRefresh: true });
          if (verdict === 'stale') {
            // False in the tray too, not just in here.
            void service.dismissDeliveredAsync(n.id);
            return null;
          }
          return body ? { ...n, body } : n;
        }),
      );
      return checked.filter((n): n is DeliveredNotification => n != null);
    },
    [refresh, validate],
  );

  useEffect(() => {
    if (!masterEnabled) {
      // Clearing on disable syncs to external state (nothing schedulable), not a
      // render cascade — the effect returns immediately after.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems([]);
      return;
    }
    // Guard every async read against a resolve that lands after this effect is
    // torn down (disable / unmount / a masterEnabled flip). Without it an
    // in-flight getDeliveredAsync could re-populate items once notifications are
    // off, defeating the masterEnabled gate.
    let cancelled = false;
    const load = () => {
      void service
        .getDeliveredAsync()
        .then((next) => validateAll(next))
        .then((next) => {
          if (!cancelled) setItems(next);
        });
    };
    load();
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') load();
    });
    const unsubscribe = service.addDeliveredListener(load);
    const id = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      appState.remove();
      unsubscribe();
      clearInterval(id);
    };
  }, [masterEnabled, validateAll]);

  // Optimistically drop the card so the tap feels instant, then tell the OS.
  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    void service.dismissDeliveredAsync(id);
  }, []);

  const dismissAll = useCallback(() => {
    setItems([]);
    void service.dismissAllDeliveredAsync();
  }, []);

  return { items, dismiss, dismissAll };
}
