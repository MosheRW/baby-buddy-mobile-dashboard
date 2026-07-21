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
import type { PlannedNotification } from '../lib/notifications';
import type { PermissionStatus } from '../stores/notificationStore';

type NotificationsModule = typeof import('expo-notifications');

const isExpoGo = Constants.appOwnership === 'expo';
const SUPPORTED = Platform.OS !== 'web' && !isExpoGo;
const CHANNEL_ID = 'reminders';

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
