/**
 * App-global running timers, keyed by {type, childId}. Persisted so a killed app
 * resumes correctly. Only one timer per (type, child) pair may run at once.
 * Phase 6 backs these with Baby Buddy's server-side timer endpoints
 * (`serverTimerId`); until then elapsed time derives from `startedAt`.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorage } from './storage';
import type { RunningTimer, TimerType } from '../lib/timers';

interface TimerState {
  timers: RunningTimer[];
  startTimer: (type: TimerType, childId: string, startedAt?: number) => void;
  stopTimer: (type: TimerType, childId: string) => void;
  getTimer: (type: TimerType, childId: string) => RunningTimer | undefined;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      timers: [],
      startTimer: (type, childId, startedAt = Date.now()) =>
        set((state) => {
          // Enforce one timer per (type, child): replace any existing.
          const rest = state.timers.filter((t) => !(t.type === type && t.childId === childId));
          return { timers: [...rest, { type, childId, startedAt }] };
        }),
      stopTimer: (type, childId) =>
        set((state) => ({
          timers: state.timers.filter((t) => !(t.type === type && t.childId === childId)),
        })),
      getTimer: (type, childId) =>
        get().timers.find((t) => t.type === type && t.childId === childId),
    }),
    {
      name: 'timers',
      storage: createJSONStorage(() => asyncStorage),
    },
  ),
);
