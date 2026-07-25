/**
 * Thin wrapper over `expo-notifications`. Everything here **no-ops** whenever the
 * platform can't deliver a local notification — web, and **Expo Go** — the same
 * way `secureStorage` degrades. The app must boot and run identically regardless.
 *
 * Why `expo-notifications` is lazily `require`d instead of imported at the top:
 * on SDK 53+ the module runs a push-token auto-registration side effect *at
 * import time* that throws inside Expo Go ("...removed from Expo Go..."), which
 * would crash the whole bundle at startup. So we must never even load the module
 * there — hence the runtime guard + lazy require, not a static `import`.
 *
 * `appOwnership === 'expo'` is true only in Expo Go; a development build reports
 * `null` (and `executionEnvironment` can't tell the two apart), so this is the
 * correct discriminator even though it's marked deprecated.
 *
 * The pure planner (`src/lib/notifications.ts`) decides *what* to schedule; this
 * module only talks to the OS. Reconciliation is deliberately blunt: every sync
 * clears our scheduled set and re-schedules the current plan. Scheduling future
 * notifications never alerts the user, so cancel-and-reschedule is invisible, and
 * it sidesteps having to detect that a reminder's fire time shifted (a med logged
 * moves `dueAt` while the notification key stays the same).
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { OngoingNotification, PlannedNotification } from '../lib/notifications';
import type { PermissionStatus } from '../stores/notificationStore';

type NotificationsModule = typeof import('expo-notifications');

const isExpoGo = Constants.appOwnership === 'expo';
const SUPPORTED = Platform.OS !== 'web' && !isExpoGo;
const CHANNEL_ID = 'reminders';
/**
 * A separate, LOW-importance channel for the ongoing running-timer notifications.
 * LOW so the OS shows them silently in the shade with no heads-up or sound — they
 * are re-issued roughly once a minute to refresh the elapsed label, and firing a
 * sound each time would be intolerable.
 */
const ONGOING_CHANNEL_ID = 'ongoing';
/** Every ongoing notification's identifier starts with this (see buildOngoing…). */
const ONGOING_PREFIX = 'ongoing:';

/** Lazily loaded native module — `undefined` = not tried, `null` = unavailable. */
let cached: NotificationsModule | null | undefined;

function nm(): NotificationsModule | null {
  if (!SUPPORTED) return null;
  if (cached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cached = require('expo-notifications') as NotificationsModule;
    } catch (err) {
      console.warn('[notifications] module unavailable:', err);
      cached = null;
    }
  }
  return cached;
}

let initialized = false;

/** Map the SDK's permission string to our store union. */
function mapStatus(status: string): PermissionStatus {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

/**
 * Register the foreground handler and (on Android) the notification channel.
 * Idempotent and safe to call at every launch.
 */
export async function initAsync(): Promise<void> {
  const N = nm();
  if (!N || initialized) return;
  initialized = true;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Reminders',
        importance: N.AndroidImportance.DEFAULT,
      });
      await N.setNotificationChannelAsync(ONGOING_CHANNEL_ID, {
        name: 'Running timers',
        // LOW keeps the minute-by-minute refreshes silent and out of heads-up.
        importance: N.AndroidImportance.LOW,
      });
    }
  } catch (err) {
    console.warn('[notifications] init failed:', err);
  }
}

/** Current permission state without prompting the user. */
export async function getPermissionStatusAsync(): Promise<PermissionStatus> {
  const N = nm();
  if (!N) return 'unsupported';
  try {
    const { status } = await N.getPermissionsAsync();
    return mapStatus(status);
  } catch (err) {
    console.warn('[notifications] permission read failed:', err);
    return 'undetermined';
  }
}

/** Request permission if not already granted; returns the resulting state. */
export async function ensurePermissionsAsync(): Promise<PermissionStatus> {
  const N = nm();
  if (!N) return 'unsupported';
  try {
    const current = await N.getPermissionsAsync();
    if (current.granted) return 'granted';
    // Blocked at the OS level — asking again just no-ops, so report it honestly.
    if (!current.canAskAgain) return mapStatus(current.status);
    const next = await N.requestPermissionsAsync();
    return mapStatus(next.status);
  } catch (err) {
    console.warn('[notifications] permission request failed:', err);
    return 'undetermined';
  }
}

/**
 * Make the OS schedule exactly `planned` and nothing else. Passing `[]` cancels
 * everything (used when notifications are turned off).
 */
export async function syncScheduledAsync(planned: PlannedNotification[]): Promise<void> {
  const N = nm();
  if (!N) return;
  try {
    // We are the only scheduler in this app, so clearing all is safe and keeps
    // reconciliation trivially correct.
    await N.cancelAllScheduledNotificationsAsync();
    for (const p of planned) {
      await N.scheduleNotificationAsync({
        identifier: p.key,
        content: {
          title: p.title,
          body: p.body,
          data: p.childId ? { childId: p.childId } : {},
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.DATE,
          date: p.fireAt,
          channelId: CHANNEL_ID,
        },
      });
    }
  } catch (err) {
    console.warn('[notifications] scheduling sync failed:', err);
  }
}

/**
 * Reconcile the presented ongoing running-timer notifications to exactly
 * `planned`. Each is presented immediately (a channel-aware trigger, not a DATE
 * one, so it never joins the *scheduled* set that `syncScheduledAsync` clears)
 * and marked `sticky` so it can't be swiped away while its timer runs. Re-issuing
 * the same identifier updates the notification in place, which is how the elapsed
 * label refreshes. Passing `[]` clears every ongoing notification we presented.
 */
export async function syncOngoingAsync(planned: OngoingNotification[]): Promise<void> {
  const N = nm();
  if (!N) return;
  try {
    const wanted = new Set(planned.map((p) => p.key));
    // Dismiss ours that are no longer running. Scoped to our prefix so we never
    // touch a delivered reminder (those live on the other channel/track).
    const presented = await N.getPresentedNotificationsAsync();
    for (const n of presented) {
      const id = (n as { request?: { identifier?: string } })?.request?.identifier;
      if (id && id.startsWith(ONGOING_PREFIX) && !wanted.has(id)) {
        await N.dismissNotificationAsync(id);
      }
    }
    for (const p of planned) {
      await N.scheduleNotificationAsync({
        identifier: p.key,
        content: {
          title: p.title,
          body: p.body,
          sticky: true,
          autoDismiss: false,
          data: { ongoing: true, ...(p.childId ? { childId: p.childId } : {}) },
        },
        // A bare `channelId` trigger = present now on this channel (immediate,
        // not pending), so cancel-all of *scheduled* notifications leaves it be.
        trigger: { channelId: ONGOING_CHANNEL_ID },
      });
    }
  } catch (err) {
    console.warn('[notifications] ongoing sync failed:', err);
  }
}

/**
 * A reminder the OS has already *delivered* (it's sitting in the tray / shade),
 * normalized away from the SDK's `Notification` shape. `id` is the OS identifier,
 * which for our own reminders equals the `PlannedNotification.key` we scheduled.
 */
export interface DeliveredNotification {
  id: string;
  title: string;
  body: string;
  childId?: string;
  /** Epoch ms the OS delivered it, for newest-first ordering. */
  deliveredAt: number;
}

/**
 * Coerce a delivered notification's `date` to epoch ms. The SDK's typing says
 * `number`, but in practice it varies by platform — Android gives epoch ms, iOS
 * can hand back a `Date` — so accept both and fall back to now for anything
 * missing/odd (rather than let a bad value scramble the newest-first ordering).
 */
function deliveredAtMs(date: unknown): number {
  if (typeof date === 'number' && date > 0) return date;
  if (date instanceof Date) {
    const ms = date.getTime();
    if (ms > 0) return ms;
  }
  return Date.now();
}

function normalizeDelivered(n: unknown): DeliveredNotification | null {
  // Guard defensively — this crosses the native bridge and the shape isn't ours.
  const req = (n as { request?: { identifier?: string; content?: Record<string, unknown> } })
    ?.request;
  const id = req?.identifier;
  if (!id) return null;
  const content = req.content ?? {};
  const data = (content.data ?? {}) as { childId?: unknown };
  return {
    id,
    title: typeof content.title === 'string' ? content.title : '',
    body: typeof content.body === 'string' ? content.body : '',
    childId: typeof data.childId === 'string' ? data.childId : undefined,
    deliveredAt: deliveredAtMs((n as { date?: unknown }).date),
  };
}

/**
 * The reminders currently presented in the tray. `[]` wherever notifications
 * can't be delivered (web, Expo Go) — so the in-app carousel is simply empty
 * there, consistent with the rest of this module degrading silently.
 */
export async function getDeliveredAsync(): Promise<DeliveredNotification[]> {
  const N = nm();
  if (!N) return [];
  try {
    const list = await N.getPresentedNotificationsAsync();
    return list
      .map(normalizeDelivered)
      .filter((n): n is DeliveredNotification => n != null)
      // The ongoing running-timer notifications share the tray but aren't
      // "reminders that fired" — keep them out of the in-app carousel.
      .filter((n) => !n.id.startsWith(ONGOING_PREFIX))
      // Newest first, so the most recently fired reminder leads the carousel.
      .sort((a, b) => b.deliveredAt - a.deliveredAt);
  } catch (err) {
    console.warn('[notifications] read delivered failed:', err);
    return [];
  }
}

/** Dismiss one delivered notification from the tray by its identifier. */
export async function dismissDeliveredAsync(id: string): Promise<void> {
  const N = nm();
  if (!N) return;
  try {
    await N.dismissNotificationAsync(id);
  } catch (err) {
    console.warn('[notifications] dismiss failed:', err);
  }
}

/** Dismiss every delivered notification. */
export async function dismissAllDeliveredAsync(): Promise<void> {
  const N = nm();
  if (!N) return;
  try {
    await N.dismissAllNotificationsAsync();
  } catch (err) {
    console.warn('[notifications] dismiss-all failed:', err);
  }
}

/**
 * Subscribe to notifications delivered while the app is foregrounded, so the
 * carousel can refresh the instant a reminder fires. Returns an unsubscribe
 * function; a no-op (returning a no-op) where notifications are unsupported.
 */
export function addDeliveredListener(onDelivered: () => void): () => void {
  const N = nm();
  if (!N) return () => {};
  try {
    const sub = N.addNotificationReceivedListener(() => onDelivered());
    return () => sub.remove();
  } catch (err) {
    console.warn('[notifications] listener failed:', err);
    return () => {};
  }
}

/** Cancel every scheduled reminder. */
export async function cancelAllAsync(): Promise<void> {
  const N = nm();
  if (!N) return;
  try {
    await N.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    console.warn('[notifications] cancel-all failed:', err);
  }
}
