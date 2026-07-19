/**
 * Time-based re-render hooks.
 * - `useMinuteTick`: a `now` value that advances every 60s, for relative-time
 *   labels ("45m ago") that would otherwise go stale.
 * - `useTimerTick`: a `now` value that advances every second, but ONLY while at
 *   least one timer is running (the interval is torn down when none are), so we
 *   don't re-render every second when nothing is timing.
 */
import { useEffect, useState } from 'react';
import { useTimerStore } from '../stores/timerStore';

export function useMinuteTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function useTimerTick(): number {
  const hasTimers = useTimerStore((s) => s.timers.length > 0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!hasTimers) return;
    // Snap to current time when the interval (re)starts so elapsed isn't stale
    // by up to a second. Runs only on hasTimers transitions, so it doesn't cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasTimers]);

  return now;
}
