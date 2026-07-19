import { elapsedClock, elapsedMs, findTimer, isTimerType, timerKey } from '../timers';
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
});
