/**
 * Local Expo native module — a thin Android bridge that posts notifications
 * carrying Android's built-in `Chronometer` widget, drawn into a custom
 * notification content view and ticked by the platform itself.
 *
 * Why this exists: `expo-notifications` (managed workflow) does not expose the
 * Android chronometer field, so it can only refresh an elapsed label on a JS
 * timer — minute-granular at best, and never truly per-second. Android's own
 * chronometer is drawn and ticked by the system every second at no JS or battery
 * cost, which is exactly what a running-timer stopwatch and a medication
 * due/overdue countdown want. There's no per-notification chronometer setting in
 * `expo-notifications` to reach for, so this small module posts those two
 * notification kinds directly instead.
 *
 * It is Android-only and **optional**: `requireOptionalNativeModule` returns
 * `null` on web and in Expo Go (and anywhere the native module wasn't built into
 * the binary), so callers degrade to a no-op exactly like `secureStorage` and the
 * rest of the notifications feature. The higher-level reconcile lives in
 * `src/notifications/chronometer.ts`.
 */
import { requireOptionalNativeModule } from 'expo-modules-core';

/** One live chronometer notification to present. Mirrors the Kotlin `Record`. */
export interface ChronometerPresentOptions {
  /** OS notification tag; re-presenting the same tag updates in place. */
  id: string;
  /** Android channel to post on — must already exist (created by the service). */
  channelId: string;
  title: string;
  text: string;
  /**
   * The chronometer's base time, epoch ms. Count-up notifications (timers) pass
   * the start; count-down ones (meds) pass the due time.
   */
  anchorMs: number;
  /** True → tick down toward `anchorMs`, then past it; false → tick up from it. */
  countDown: boolean;
  /** Sticky (non-swipeable) while true. */
  ongoing: boolean;
}

export interface ChronometerNativeModule {
  present(options: ChronometerPresentOptions): Promise<void>;
  dismiss(id: string): Promise<void>;
  /**
   * Cancel every chronometer notification of ours whose tag is not in `wanted`,
   * and return the tags that remain. The cancellation is matched entirely
   * native-side against the live notification tags, so a non-ASCII tag (a Hebrew
   * medicine name) can't fail to match after a JS-bridge round-trip — see the
   * Kotlin `reconcile`.
   */
  reconcile(wanted: string[]): Promise<string[]>;
  /** Tags of the chronometer notifications this module currently has presented. */
  getActiveIds(): Promise<string[]>;
}

/** The native module, or `null` where it isn't available (web / Expo Go). */
export const ChronometerNotification = requireOptionalNativeModule<ChronometerNativeModule>(
  'ChronometerNotification',
);
