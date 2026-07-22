/**
 * Fires `onShake` when the device is shaken, while `enabled`. Built on
 * `expo-sensors` `Accelerometer`.
 *
 * Degrades to a no-op wherever the sensor is unavailable (web, many emulators) —
 * `isAvailableAsync` is false or the module throws, and the "show hidden" button
 * is the fallback there, exactly like `secureStorage`/notifications no-op off the
 * device. Works in Expo Go (unlike push notifications), so it's verifiable on a
 * real phone without an EAS build.
 */
import { useEffect, useRef } from 'react';
import { Accelerometer } from 'expo-sensors';

// At rest the magnitude is ~1g (gravity). A deliberate shake spikes well past
// this; the cooldown collapses the burst of over-threshold samples one shake
// produces into a single event.
const SHAKE_THRESHOLD = 1.8;
const SHAKE_COOLDOWN_MS = 1000;
const UPDATE_INTERVAL_MS = 200;

export function useShakeDetector(onShake: () => void, enabled: boolean): void {
  const lastShakeAt = useRef(0);
  // Keep the latest callback without re-subscribing the sensor on every render.
  const onShakeRef = useRef(onShake);
  useEffect(() => {
    onShakeRef.current = onShake;
  }, [onShake]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let subscription: { remove: () => void } | undefined;

    (async () => {
      try {
        const available = await Accelerometer.isAvailableAsync();
        if (!available || cancelled) return;
        Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
        subscription = Accelerometer.addListener(({ x, y, z }) => {
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          if (magnitude <= SHAKE_THRESHOLD) return;
          const now = Date.now();
          if (now - lastShakeAt.current < SHAKE_COOLDOWN_MS) return;
          lastShakeAt.current = now;
          onShakeRef.current();
        });
      } catch {
        // Sensor unavailable — the manual "show hidden" button covers this.
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);
}
