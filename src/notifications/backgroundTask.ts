/**
 * Opt-in periodic background refresh, layered over `expo-background-task` +
 * `expo-task-manager` (Android WorkManager). It shrinks — but cannot close — the
 * gap documented in `service.ts`: a local notification that fires while the app is
 * killed can't be intercepted at delivery (no push backend to run a background task
 * *at delivery*). This runs roughly every 15 minutes while backgrounded/killed,
 * re-fetches the server, and rebuilds the **scheduled** plan so a reminder that
 * later fires in the dead window carries data at most ~15 min stale instead of
 * "as of the last app-open". The delivery-time interception while fully dead is
 * still impossible; the in-app carousel (gate 3) cleans up after the fact.
 *
 * Degradation mirrors `service.ts` exactly: everything **no-ops** on web and in
 * **Expo Go**, the native modules are **lazily `require`d** (never imported at the
 * top — loading them in Expo Go throws), and every native call is wrapped so a
 * failure warns rather than crashes. `getStatusAsync` needs a dev/EAS build to
 * report anything but `unsupported`.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { BackgroundStatus } from '../stores/notificationStore';
import { runScheduledNotificationSync } from './rebuild';

type BackgroundTaskModule = typeof import('expo-background-task');
type TaskManagerModule = typeof import('expo-task-manager');

const isExpoGo = Constants.appOwnership === 'expo';
const SUPPORTED = Platform.OS !== 'web' && !isExpoGo;

/**
 * WorkManager task identifier. Persisted by the OS once registered, so keep it
 * stable — renaming it orphans an already-registered job on upgraded installs.
 */
const TASK_NAME = 'baby-buddy-notification-refresh';

/**
 * Requested cadence in minutes. The OS treats it as a *minimum* and batches wakeups
 * to save battery; 15 is the platform floor, so asking for less is pointless.
 */
const MINIMUM_INTERVAL_MINUTES = 15;

let backgroundCached: BackgroundTaskModule | null | undefined;
let taskManagerCached: TaskManagerModule | null | undefined;

function backgroundTask(): BackgroundTaskModule | null {
  if (!SUPPORTED) return null;
  if (backgroundCached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      backgroundCached = require('expo-background-task') as BackgroundTaskModule;
    } catch (err) {
      console.warn('[backgroundTask] module unavailable:', err);
      backgroundCached = null;
    }
  }
  return backgroundCached;
}

function taskManager(): TaskManagerModule | null {
  if (!SUPPORTED) return null;
  if (taskManagerCached === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      taskManagerCached = require('expo-task-manager') as TaskManagerModule;
    } catch (err) {
      console.warn('[backgroundTask] task-manager unavailable:', err);
      taskManagerCached = null;
    }
  }
  return taskManagerCached;
}

let defined = false;

/**
 * Register the task *executor* with TaskManager. Must run before the OS invokes
 * the task, so it's called at JS init from `index.ts` (module scope), which runs
 * for a headless WorkManager cold start too — not from a React effect, which
 * wouldn't have run yet when no UI mounts. Idempotent, and internally guarded so it
 * no-ops (never touching the native module) on web/Expo Go.
 */
export function defineBackgroundTask(): void {
  const TM = taskManager();
  const BT = backgroundTask();
  if (!TM || !BT || defined) return;
  defined = true;
  try {
    TM.defineTask(TASK_NAME, async () => {
      try {
        await runScheduledNotificationSync();
        return BT.BackgroundTaskResult.Success;
      } catch (err) {
        console.warn('[backgroundTask] run failed:', err);
        return BT.BackgroundTaskResult.Failed;
      }
    });
  } catch (err) {
    console.warn('[backgroundTask] defineTask failed:', err);
  }
}

/** Start (or keep) the periodic background refresh. No-op where unsupported. */
export async function registerBackgroundTaskAsync(): Promise<void> {
  const BT = backgroundTask();
  if (!BT) return;
  // The executor must exist before registration; safe to call again.
  defineBackgroundTask();
  try {
    await BT.registerTaskAsync(TASK_NAME, { minimumInterval: MINIMUM_INTERVAL_MINUTES });
  } catch (err) {
    console.warn('[backgroundTask] register failed:', err);
  }
}

/** Stop the periodic background refresh. No-op where unsupported or not registered. */
export async function unregisterBackgroundTaskAsync(): Promise<void> {
  const BT = backgroundTask();
  const TM = taskManager();
  if (!BT || !TM) return;
  try {
    // Unregistering a task that was never registered throws; guard on it.
    const isRegistered = await TM.isTaskRegisteredAsync(TASK_NAME);
    if (isRegistered) await BT.unregisterTaskAsync(TASK_NAME);
  } catch (err) {
    console.warn('[backgroundTask] unregister failed:', err);
  }
}

/**
 * Current OS availability of background tasks. `restricted` on a real device means
 * the OS is throttling background work (battery optimization); `unsupported` is
 * web/Expo Go, where the capability doesn't exist.
 */
export async function getBackgroundStatusAsync(): Promise<BackgroundStatus> {
  const BT = backgroundTask();
  if (!BT) return 'unsupported';
  try {
    const status = await BT.getStatusAsync();
    if (status === BT.BackgroundTaskStatus.Available) return 'available';
    if (status === BT.BackgroundTaskStatus.Restricted) return 'restricted';
    return 'unknown';
  } catch (err) {
    console.warn('[backgroundTask] status read failed:', err);
    return 'unknown';
  }
}
