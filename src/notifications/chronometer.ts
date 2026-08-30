/**
 * Reconcile layer for the native chronometer notifications (see the local module
 * `modules/chronometer-notification`). Where `service.ts` wraps
 * `expo-notifications`, this wraps our small Kotlin module — the only way to get a
 * true per-second ticking clock (running-timer stopwatch, medication countdown)
 * in the managed workflow.
 *
 * Degrades to a no-op exactly like `service.ts`: on web / Expo Go / any build
 * without the native module, `ChronometerNotification` is `null` and every export
 * here quietly does nothing, so callers never branch on the platform themselves —
 * they check `isSupported()` only to decide whether to fall back to the
 * minute-granular `service.syncOngoingAsync` track instead.
 */
import { Platform } from 'react-native';
import { ChronometerNotification } from '../../modules/chronometer-notification';
import type { ChronometerSpec } from '../lib/notifications';
import { ONGOING_CHANNEL_ID, actionButtonTitle, type NotificationActionEvent } from './service';

/**
 * Monotonic reconcile generation. Reconciles are launched fire-and-forget from a
 * React effect, so two can overlap; without this an older call could reach its
 * dismiss pass holding a stale `wanted` set and cancel a notification the newer
 * call just presented. Each call stamps itself and bails out of the dismiss pass
 * once a newer call has started — the newer one is authoritative and will
 * reconcile the full set itself.
 */
let generation = 0;

/**
 * Whether native chronometer notifications are available on this build. When
 * false the caller keeps using the `expo-notifications` ongoing track (elapsed
 * label refreshed on the JS tick) instead.
 */
export function isSupported(): boolean {
  return Platform.OS !== 'web' && ChronometerNotification != null;
}

/**
 * Make the presented chronometer notifications exactly `specs`. Each is presented
 * (or updated in place, since the tag is stable) on the LOW ongoing channel; any
 * of ours no longer wanted is dismissed. Passing `[]` clears them all. No-op
 * where the module is absent.
 */
export async function syncChronometerAsync(specs: ChronometerSpec[]): Promise<void> {
  const mod = ChronometerNotification;
  if (!mod) return;
  const myGeneration = ++generation;
  try {
    const wanted = new Set(specs.map((s) => s.key));
    for (const s of specs) {
      await mod.present({
        id: s.key,
        channelId: ONGOING_CHANNEL_ID,
        title: s.title,
        text: s.text,
        anchorMs: s.anchorMs,
        countDown: s.countDown,
        // Timers and med countdowns alike stay put until their premise ends
        // (timer stopped / dose logged) — the reconcile is what removes them.
        ongoing: true,
        childId: s.childId ?? '',
        // Button titles are localized here (JS owns i18n); the native side just
        // renders them and echoes the action id + childId back on a tap.
        actions: (s.actions ?? []).map((id) => ({ id, title: actionButtonTitle(id) })),
      });
    }
    // A newer reconcile started while we awaited — it owns the authoritative
    // `wanted` set now, so skip our dismiss pass rather than cancel something it
    // just presented against a set we've since gone stale on.
    if (myGeneration !== generation) return;
    // Cancel every chronometer of ours no longer wanted, in a single native call.
    // The match/cancel happens against the live notification tags inside the
    // module, so a non-ASCII tag (a Hebrew medicine name) can't slip through a
    // JS-bridge re-encoding the way a `getActiveIds` → `dismiss(tag)` round-trip
    // could — which used to leave overdue med countdowns stuck as undismissable
    // ongoing notifications. `reconcile` is scoped to this module's own
    // notification id, so a foreign notification is never touched.
    await mod.reconcile([...wanted]);
  } catch (err) {
    console.warn('[chronometer] sync failed:', err);
  }
}

/**
 * Subscribe to a tap on one of the chronometer's action buttons that arrives
 * while the app is already running. The native payload is already shaped like
 * `service.NotificationActionEvent`, so `useNotificationActions.handleAction`
 * consumes it unchanged (the `cancel-<type>` / `end-<type>` buttons on a
 * running-timer chronometer route exactly as they do from the scheduled
 * reminder). No-op — returning a no-op unsubscribe — where the module is absent.
 */
export function addActionListener(
  handler: (event: NotificationActionEvent) => void,
): () => void {
  const mod = ChronometerNotification;
  if (!mod) return () => {};
  try {
    const sub = mod.addListener('onChronometerAction', (e) =>
      handler({ actionIdentifier: e.actionIdentifier, id: e.id, childId: e.childId ?? undefined }),
    );
    return () => sub.remove();
  } catch (err) {
    console.warn('[chronometer] action listener failed:', err);
    return () => {};
  }
}

/**
 * The action tap that cold-started the app, if any — the warm-start path above
 * never sees it because the listener is registered after the launch. Consumed
 * once (cleared native-side). Null where the module is absent or no button
 * launched the app.
 */
export async function getLastActionAsync(): Promise<NotificationActionEvent | null> {
  const mod = ChronometerNotification;
  if (!mod) return null;
  try {
    const e = await mod.consumeLastAction();
    return e
      ? { actionIdentifier: e.actionIdentifier, id: e.id, childId: e.childId ?? undefined }
      : null;
  } catch (err) {
    console.warn('[chronometer] last action read failed:', err);
    return null;
  }
}
