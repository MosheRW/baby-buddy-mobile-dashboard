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
import { CHRONO_MED_PREFIX, CHRONO_TIMER_PREFIX } from '../lib/notifications';
import { ONGOING_CHANNEL_ID } from './service';

/** The key prefixes this track owns — used to scope reconcile/dismiss. */
const OWNED_PREFIXES = [CHRONO_TIMER_PREFIX, CHRONO_MED_PREFIX];

const isOwned = (id: string) => OWNED_PREFIXES.some((p) => id.startsWith(p));

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
      });
    }
    // A newer reconcile started while we awaited — it owns the authoritative
    // `wanted` set now, so skip our dismiss pass rather than cancel something it
    // just presented against a set we've since gone stale on.
    if (myGeneration !== generation) return;
    // Dismiss ours that are no longer live. Scoped to our prefixes so a foreign
    // notification is never touched (and `getActiveIds` already filters to this
    // module's notifications).
    const active = await mod.getActiveIds();
    if (myGeneration !== generation) return;
    for (const id of active) {
      if (isOwned(id) && !wanted.has(id)) await mod.dismiss(id);
    }
  } catch (err) {
    console.warn('[chronometer] sync failed:', err);
  }
}
