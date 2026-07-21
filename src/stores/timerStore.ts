/**
 * App-global running timers, keyed by {type, childId}. Persisted so a killed app
 * resumes correctly. Only one timer per (type, child) pair may run at once.
 *
 * Baby Buddy's `/api/timers/` is the shared source of truth (see `useTimerSync`),
 * but this store stays authoritative for what the UI draws: a timer must start
 * instantly and keep running when the network doesn't cooperate. Server ids are
 * attached once the create call returns, and `setTimers` folds the server's view
 * back in on launch and refresh.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorage } from './storage';
import type { RunningTimer, TimerType } from '../lib/timers';

interface TimerState {
  timers: RunningTimer[];
  /**
   * Server timer ids whose delete is still in flight. Reconciliation ignores
   * them, so a slow stop can't re-adopt the timer the user just stopped. Not
   * persisted: an in-flight request doesn't survive an app kill, and the server
   * is then the honest answer about whether the timer is still running.
   */
  stopping: number[];
  markStopping: (serverTimerId: number) => void;
  clearStopping: (serverTimerId: number) => void;
  /** Adds the timer locally and returns it, so the caller can push it up. */
  startTimer: (type: TimerType, childId: string, startedAt?: number) => RunningTimer;
  /** Removes the timer and returns it — its `serverTimerId` is what gets deleted. */
  stopTimer: (type: TimerType, childId: string) => RunningTimer | undefined;
  /** Adjusts a running timer's start, e.g. after the caregiver edits it by hand. */
  updateStart: (type: TimerType, childId: string, startedAt: number) => void;
  attachServerId: (type: TimerType, childId: string, serverTimerId: number) => void;
  /** Replace the whole list (reconciliation result). */
  setTimers: (timers: RunningTimer[]) => void;
  getTimer: (type: TimerType, childId: string) => RunningTimer | undefined;
}

const isPair = (t: RunningTimer, type: TimerType, childId: string) =>
  t.type === type && t.childId === childId;

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      timers: [],
      stopping: [],

      markStopping: (serverTimerId) =>
        set((state) => ({
          stopping: state.stopping.includes(serverTimerId)
            ? state.stopping
            : [...state.stopping, serverTimerId],
        })),

      clearStopping: (serverTimerId) =>
        set((state) => ({ stopping: state.stopping.filter((id) => id !== serverTimerId) })),

      startTimer: (type, childId, startedAt = Date.now()) => {
        const timer: RunningTimer = { type, childId, startedAt };
        set((state) => ({
          // Enforce one timer per (type, child): replace any existing.
          timers: [...state.timers.filter((t) => !isPair(t, type, childId)), timer],
        }));
        return timer;
      },

      stopTimer: (type, childId) => {
        const stopped = get().timers.find((t) => isPair(t, type, childId));
        set((state) => ({ timers: state.timers.filter((t) => !isPair(t, type, childId)) }));
        return stopped;
      },

      updateStart: (type, childId, startedAt) =>
        set((state) => ({
          timers: state.timers.map((t) => (isPair(t, type, childId) ? { ...t, startedAt } : t)),
        })),

      attachServerId: (type, childId, serverTimerId) =>
        set((state) => ({
          timers: state.timers.map((t) => (isPair(t, type, childId) ? { ...t, serverTimerId } : t)),
        })),

      setTimers: (timers) => set({ timers }),

      getTimer: (type, childId) => get().timers.find((t) => isPair(t, type, childId)),
    }),
    {
      name: 'timers',
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => ({ timers: state.timers }),
    },
  ),
);
