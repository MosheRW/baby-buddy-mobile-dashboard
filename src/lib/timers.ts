/**
 * Pure timer helpers. Timer *state* lives in the app-global timerStore, keyed by
 * {type, childId}; these functions compute keys and elapsed time from a start
 * timestamp so displays derive from `startedAt` (not an accumulating counter).
 */
import type { EntryType } from '../api/types';

/** Entry types that support a background timer. */
export const TIMER_TYPES = ['feeding', 'sleep', 'tummyTime'] as const;
export type TimerType = (typeof TIMER_TYPES)[number];

export interface RunningTimer {
  type: TimerType;
  childId: string;
  /** Epoch ms when the timer started. */
  startedAt: number;
  /**
   * Baby Buddy server-side timer id. Absent means the timer is local-only —
   * either it was started while offline, or the create call failed. Such a
   * timer still runs; it just isn't visible in the Baby Buddy web UI.
   */
  serverTimerId?: number;
}

/**
 * Baby Buddy's Timer model has no type field — a timer is just {child, name,
 * start}. The name is how we recognise our own timers on the way back, so it
 * doubles as a human-readable label in the Baby Buddy web UI.
 */
export const TIMER_NAMES: Record<TimerType, string> = {
  feeding: 'Feeding',
  sleep: 'Sleep',
  tummyTime: 'Tummy Time',
};

/** Match loosely: a name edited in the web UI shouldn't orphan the timer. */
export function timerTypeFromName(name: string | null | undefined): TimerType | undefined {
  if (!name) return undefined;
  const normalized = name.trim().toLowerCase().replace(/\s+/g, '');
  return TIMER_TYPES.find((t) => TIMER_NAMES[t].toLowerCase().replace(/\s+/g, '') === normalized);
}

export function isTimerType(type: EntryType): type is TimerType {
  return (TIMER_TYPES as readonly string[]).includes(type);
}

/** Stable key for a (type, child) timer pair. */
export function timerKey(type: TimerType, childId: string): string {
  return `${type}:${childId}`;
}

export function findTimer(
  timers: RunningTimer[],
  type: EntryType,
  childId: string,
): RunningTimer | undefined {
  if (!isTimerType(type)) return undefined;
  return timers.find((t) => t.type === type && t.childId === childId);
}

export function elapsedMs(startedAt: number, now: number = Date.now()): number {
  return Math.max(0, now - startedAt);
}

/**
 * Merge the persisted local timers with what the server says is running.
 *
 * The server is the shared source of truth — a timer stopped from the Baby
 * Buddy web UI, or on another phone, must disappear here too. But a local timer
 * that never reached the server (offline start, failed create) is the only
 * record of itself, so it survives: dropping it would silently lose a running
 * timer the caregiver is watching.
 *
 * Both effects follow from one rule: a local timer is discarded only when it
 * *claims* a server id the server no longer lists.
 *
 * `stoppingIds` are timers whose delete is still in flight. Without them a stop
 * that is slower than the next poll would re-adopt the timer the caregiver just
 * stopped, and it would visibly pop back onto the dashboard.
 */
export function reconcileTimers(
  local: RunningTimer[],
  server: RunningTimer[],
  stoppingIds: readonly number[] = [],
): RunningTimer[] {
  const stopping = new Set(stoppingIds);
  const live = server.filter((t) => t.serverTimerId === undefined || !stopping.has(t.serverTimerId));
  const claimed = new Set(live.map((t) => timerKey(t.type, t.childId)));

  const survivors = local.filter((t) => {
    if (claimed.has(timerKey(t.type, t.childId))) return false; // server's copy wins
    return t.serverTimerId === undefined;
  });

  return [...live, ...survivors].sort((a, b) => a.startedAt - b.startedAt);
}

/** mm:ss from a start timestamp — for live timer displays. */
export function elapsedClock(startedAt: number, now: number = Date.now()): string {
  const totalSec = Math.floor(elapsedMs(startedAt, now) / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
