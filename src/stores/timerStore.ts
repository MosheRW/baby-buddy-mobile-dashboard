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
import { timerKey, type RunningTimer, type TimerType } from '../lib/timers';
import type { FormDraft } from '../lib/formDraft';

interface TimerState {
  timers: RunningTimer[];
  /**
   * Draft details stashed for a running timer via the form's "Save details"
   * button, keyed by timerKey. Kept in a map separate from `timers` on purpose:
   * `setTimers` replaces the timers list with the server's reconciled view,
   * which carries no draft, so folding the draft into a timer would lose it on
   * the next poll. Persisted like the timers themselves, so a caregiver who
   * pre-filled a feed's details keeps them across an app kill.
   */
  drafts: Record<string, FormDraft>;
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
  /** Stash the form draft to reapply when this timer is stopped-and-saved. */
  saveDraft: (type: TimerType, childId: string, draft: FormDraft) => void;
  getDraft: (type: TimerType, childId: string) => FormDraft | undefined;
}

const isPair = (t: RunningTimer, type: TimerType, childId: string) =>
  t.type === type && t.childId === childId;

/** Drop the saved draft for a (type, child) pair; returns a new map. */
function withoutDraft(
  drafts: Record<string, FormDraft>,
  type: TimerType,
  childId: string,
): Record<string, FormDraft> {
  const key = timerKey(type, childId);
  if (!(key in drafts)) return drafts;
  const { [key]: _removed, ...rest } = drafts;
  return rest;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      timers: [],
      drafts: {},
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
          // A fresh timer is a fresh activity — a draft saved for the previous
          // one must not carry over onto it.
          drafts: withoutDraft(state.drafts, type, childId),
        }));
        return timer;
      },

      stopTimer: (type, childId) => {
        const stopped = get().timers.find((t) => isPair(t, type, childId));
        set((state) => ({
          timers: state.timers.filter((t) => !isPair(t, type, childId)),
          // The draft's only purpose was to survive until the timer stopped;
          // by the time this runs it's been folded into the saved entry.
          drafts: withoutDraft(state.drafts, type, childId),
        }));
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

      setTimers: (timers) =>
        set((state) => {
          // A timer stopped elsewhere (web UI, another device) drops off the
          // reconciled list; its stashed draft has nothing left to attach to,
          // so prune drafts down to the pairs that still have a running timer.
          const live = new Set(timers.map((t) => timerKey(t.type, t.childId)));
          const drafts = Object.fromEntries(
            Object.entries(state.drafts).filter(([key]) => live.has(key)),
          );
          return { timers, drafts };
        }),

      getTimer: (type, childId) => get().timers.find((t) => isPair(t, type, childId)),

      saveDraft: (type, childId, draft) =>
        set((state) => ({ drafts: { ...state.drafts, [timerKey(type, childId)]: draft } })),

      getDraft: (type, childId) => get().drafts[timerKey(type, childId)],
    }),
    {
      name: 'timers',
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => ({ timers: state.timers, drafts: state.drafts }),
    },
  ),
);
