import {
  elapsedClock,
  elapsedMs,
  findTimer,
  isTimerType,
  reconcileTimers,
  timerKey,
  timerTypeFromName,
} from '../timers';
import type { RunningTimer } from '../timers';

const NOW = 1_000_000_000_000;

describe('timer helpers', () => {
  it('identifies timer-capable entry types', () => {
    expect(isTimerType('feeding')).toBe(true);
    expect(isTimerType('sleep')).toBe(true);
    expect(isTimerType('tummyTime')).toBe(true);
    expect(isTimerType('diaper')).toBe(false);
    expect(isTimerType('note')).toBe(false);
  });

  it('builds a stable key per (type, child)', () => {
    expect(timerKey('feeding', 'c1')).toBe('feeding:c1');
    expect(timerKey('sleep', 'c2')).toBe('sleep:c2');
  });

  it('finds a running timer for a (type, child) pair and returns undefined for non-timer types', () => {
    const timers: RunningTimer[] = [
      { type: 'feeding', childId: 'c1', startedAt: NOW },
      { type: 'sleep', childId: 'c2', startedAt: NOW },
    ];
    expect(findTimer(timers, 'feeding', 'c1')?.childId).toBe('c1');
    expect(findTimer(timers, 'feeding', 'c2')).toBeUndefined();
    expect(findTimer(timers, 'diaper', 'c1')).toBeUndefined();
  });

  it('computes elapsed ms clamped at zero', () => {
    expect(elapsedMs(NOW, NOW + 5000)).toBe(5000);
    expect(elapsedMs(NOW, NOW - 5000)).toBe(0);
  });

  it('formats elapsed as mm:ss with zero-padding', () => {
    expect(elapsedClock(NOW, NOW + 5000)).toBe('00:05');
    expect(elapsedClock(NOW, NOW + 65000)).toBe('01:05');
    expect(elapsedClock(NOW, NOW + 725000)).toBe('12:05');
  });

  it('rolls into an hours segment in digital format', () => {
    expect(elapsedClock(NOW, NOW + 5000, 'digital')).toBe('0:05');
    expect(elapsedClock(NOW, NOW + 65000, 'digital')).toBe('1:05');
    // 1h 5m 3s — the minutes stay two-digit once an hours field appears.
    expect(elapsedClock(NOW, NOW + (3600 + 5 * 60 + 3) * 1000, 'digital')).toBe('1:05:03');
  });
});

describe('timerTypeFromName', () => {
  it('recognises the names we write', () => {
    expect(timerTypeFromName('Feeding-BBapp:1')).toBe('feeding');
    expect(timerTypeFromName('Sleep-BBapp:2')).toBe('sleep');
    expect(timerTypeFromName('Tummy time-BBapp:3')).toBe('tummyTime');
  });

  it('tolerates casing and spacing drift from the web UI', () => {
    expect(timerTypeFromName('  tummy time-bbapp:3 ')).toBe('tummyTime');
    expect(timerTypeFromName('SLEEP-BBAPP:2')).toBe('sleep');
  });

  it('leaves unrelated timers unclassified rather than guessing', () => {
    expect(timerTypeFromName('Quick Timer')).toBeUndefined();
    expect(timerTypeFromName('Feeding')).toBeUndefined();
    expect(timerTypeFromName('')).toBeUndefined();
    expect(timerTypeFromName(null)).toBeUndefined();
  });
});

describe('reconcileTimers', () => {
  const local = (over: Partial<RunningTimer> = {}): RunningTimer => ({
    type: 'feeding',
    childId: 'c1',
    startedAt: NOW,
    ...over,
  });

  it('adopts a timer started elsewhere', () => {
    const server = [local({ type: 'sleep', serverTimerId: 7 })];
    expect(reconcileTimers([], server)).toEqual(server);
  });

  it('drops a local timer whose server copy is gone — it was stopped elsewhere', () => {
    expect(reconcileTimers([local({ serverTimerId: 7 })], [])).toEqual([]);
  });

  it('keeps a local-only timer that never reached the server', () => {
    const offline = local();
    expect(reconcileTimers([offline], [])).toEqual([offline]);
  });

  it('lets the server copy win over a local one for the same (type, child)', () => {
    const server = [local({ startedAt: NOW - 60_000, serverTimerId: 7 })];
    expect(reconcileTimers([local()], server)).toEqual(server);
  });

  it('does not re-adopt a timer whose stop is still in flight', () => {
    const server = [local({ serverTimerId: 7 })];
    expect(reconcileTimers([], server, [7])).toEqual([]);
  });

  it('returns timers oldest first', () => {
    const older = local({ type: 'sleep', startedAt: NOW - 5000, serverTimerId: 1 });
    const newer = local({ type: 'tummyTime', startedAt: NOW, serverTimerId: 2 });
    expect(reconcileTimers([], [newer, older]).map((t) => t.type)).toEqual(['sleep', 'tummyTime']);
  });
});
