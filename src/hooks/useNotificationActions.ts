/**
 * Reacts to Android notification-action taps — "remind later" on a
 * forgotten-timer/diaper/food reminder snoozes it; "stop timer"/"add now"
 * open the same prefilled log-entry form tapping the reminder in the in-app
 * carousel would (see `notificationAction` in `src/lib/notifications.ts`).
 * Mounted once, above the screens, alongside `useNotificationSync`.
 *
 * A plain tap on the notification body (the SDK's default action identifier)
 * is deliberately left alone here — it keeps its existing behaviour of just
 * opening the app, with the in-app carousel as the place to act on it.
 */
import { useEffect } from 'react';
import * as service from '../notifications/service';
import { notificationAction } from '../lib/notifications';
import { useNotificationStore } from '../stores/notificationStore';
import { navigationRef } from '../navigation/navigationRef';

const MINUTE = 60_000;

function handleAction(event: service.NotificationActionEvent): void {
  if (event.actionIdentifier === service.ACTION_REMIND_LATER) {
    const minutes = useNotificationStore.getState().snoozeMinutes;
    useNotificationStore.getState().snoozeNotification(event.id, Date.now() + minutes * MINUTE);
    return;
  }

  if (
    event.actionIdentifier !== service.ACTION_STOP_TIMER &&
    event.actionIdentifier !== service.ACTION_ADD_NOW
  ) {
    return;
  }

  if (!event.childId || !navigationRef.isReady()) return;
  const action = notificationAction(event.id);
  if (action.kind === 'timer') {
    navigationRef.navigate('LogEntry', { mode: 'create', childId: event.childId, type: action.timerType });
  } else if (action.kind === 'create') {
    navigationRef.navigate('LogEntry', { mode: 'create', childId: event.childId, type: action.entryType });
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
