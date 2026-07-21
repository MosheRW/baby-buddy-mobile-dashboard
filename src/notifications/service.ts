/**
 * Thin wrapper over `expo-notifications`. Everything here **no-ops on web** (and
 * degrades on any thrown platform error) the same way `secureStorage` does — the
 * app must boot and run identically whether or not notifications are available.
 *
 * The pure planner (`src/lib/notifications.ts`) decides *what* to schedule; this
 * module only talks to the OS. Reconciliation is deliberately blunt: every sync
 * clears our scheduled set and re-schedules the current plan. Scheduling future
 * notifications never alerts the user, so cancel-and-reschedule is invisible, and
 * it sidesteps having to detect that a reminder's fire time shifted (a med logged
 * moves `dueAt` while the notification key stays the same).
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { PlannedNotification } from '../lib/notifications';
import type { PermissionStatus } from '../stores/notificationStore';

const SUPPORTED = Platform.OS !== 'web';
const CHANNEL_ID = 'reminders';

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
  if (!SUPPORTED || initialized) return;
  initialized = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
  } catch (err) {
    console.warn('[notifications] init failed:', err);
  }
}

/** Current permission state without prompting the user. */
export async function getPermissionStatusAsync(): Promise<PermissionStatus> {
  if (!SUPPORTED) return 'unsupported';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return mapStatus(status);
  } catch (err) {
    console.warn('[notifications] permission read failed:', err);
    return 'undetermined';
  }
}

/** Request permission if not already granted; returns the resulting state. */
export async function ensurePermissionsAsync(): Promise<PermissionStatus> {
  if (!SUPPORTED) return 'unsupported';
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return 'granted';
    // Blocked at the OS level — asking again just no-ops, so report it honestly.
    if (!current.canAskAgain) return mapStatus(current.status);
    const next = await Notifications.requestPermissionsAsync();
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
  if (!SUPPORTED) return;
  try {
    // We are the only scheduler in this app, so clearing all is safe and keeps
    // reconciliation trivially correct.
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const p of planned) {
      await Notifications.scheduleNotificationAsync({
        identifier: p.key,
        content: {
          title: p.title,
          body: p.body,
          data: p.childId ? { childId: p.childId } : {},
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
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
  if (!SUPPORTED) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    console.warn('[notifications] cancel-all failed:', err);
  }
}
