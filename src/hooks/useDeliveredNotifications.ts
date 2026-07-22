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
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useNotificationStore } from '../stores';
import * as service from '../notifications/service';
import type { DeliveredNotification } from '../notifications/service';

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
      void service.getDeliveredAsync().then((next) => {
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
  }, [masterEnabled]);

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
