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
  /** Baby Buddy server-side timer id, when backed by the API (Phase 6). */
  serverTimerId?: number;
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

/** mm:ss from a start timestamp — for live timer displays. */
export function elapsedClock(startedAt: number, now: number = Date.now()): string {
  const totalSec = Math.floor(elapsedMs(startedAt, now) / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
