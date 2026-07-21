/**
 * Bridges the local timer store to Baby Buddy's `/api/timers/`.
 *
 * The rule throughout: the local store drives the UI, the server makes timers
 * durable and shared. Starting or stopping updates the store first and talks to
 * the server after, so a timer never waits on the network — a failed call
 * leaves a local-only timer that still runs, still shows, and still produces an
 * entry when stopped. What it loses is visibility in the Baby Buddy web UI.
 */
import { useEffect, useMemo } from 'react';
import { serverNow } from '../api/client';
import { useServerTimers, useStartTimer, useStopTimer, useUpdateTimerStart } from '../data/queries';
import { reconcileTimers, type RunningTimer, type TimerType } from '../lib/timers';
import { useTimerStore } from '../stores';

/**
 * Folds the server's running timers into the store whenever they're refetched.
 * Mount once, above the screens — a timer started on another device or in the
 * Baby Buddy web UI shows up here, and one stopped there disappears.
 */
export function useTimerSync(): void {
  const { data } = useServerTimers();
  const setTimers = useTimerStore((s) => s.setTimers);

  // Reconcile against the freshest local state, not a render-time snapshot: a
  // timer started between the fetch and this effect must not be clobbered.
  useEffect(() => {
    if (!data) return;
    const { timers, stopping } = useTimerStore.getState();
    const next = reconcileTimers(timers, data, stopping);
    if (!sameTimers(timers, next)) setTimers(next);
  }, [data, setTimers]);
}

/** Cheap structural compare — avoids a store write (and re-render) per poll. */
function sameTimers(a: RunningTimer[], b: RunningTimer[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((t, i) => identity(t) === identity(b[i]));
}

const identity = (t: RunningTimer) =>
  `${t.type}:${t.childId}:${t.startedAt}:${t.serverTimerId ?? ''}`;

export interface TimerActions {
  start: (type: TimerType, childId: string) => void;
  /** Returns the stopped timer's span, or undefined if nothing was running. */
  stop: (type: TimerType, childId: string) => { startedAt: number; endedAt: number } | undefined;
  /**
   * Adjusts a running timer's start after the caregiver edits it by hand in the
   * log-entry form. No-ops if no such timer is running.
   */
  updateStart: (type: TimerType, childId: string, startedAt: number) => void;
}

export function useTimerActions(): TimerActions {
  // `mutate` is stable across renders, so these actions are too.
  const startTimer = useStartTimer().mutate;
  const stopServerTimer = useStopTimer().mutate;
  const updateTimerStart = useUpdateTimerStart().mutate;

  return useMemo(
    () => ({
      start: (type, childId) => {
        // serverNow, not Date.now: Timer.clean() runs validate_time on `start`,
        // so a phone running fast would have its timer refused outright.
        const startedAt = serverNow();
        useTimerStore.getState().startTimer(type, childId, startedAt);

        startTimer(
          { type, childId, startedAt },
          {
            onSuccess: (timer) => {
              if (timer.serverTimerId !== undefined) {
                useTimerStore.getState().attachServerId(type, childId, timer.serverTimerId);
              }
            },
            onError: (error) => {
              console.warn('[timers] started locally only:', error);
            },
          },
        );
      },

      stop: (type, childId) => {
        const stopped = useTimerStore.getState().stopTimer(type, childId);
        if (!stopped) return undefined;

        const id = stopped.serverTimerId;
        if (id !== undefined) {
          useTimerStore.getState().markStopping(id);
          stopServerTimer(id, {
            onError: (error) => {
              // The delete failed, so the server still lists it. Clearing the
              // hold regardless lets the next poll bring the timer back, rather
              // than leaving it running on the server with nothing showing it.
              console.warn('[timers] could not stop the server timer:', error);
            },
            onSettled: () => useTimerStore.getState().clearStopping(id),
          });
        }

        return { startedAt: stopped.startedAt, endedAt: serverNow() };
      },

      updateStart: (type, childId, startedAt) => {
        const timer = useTimerStore.getState().getTimer(type, childId);
        if (!timer) return;
        useTimerStore.getState().updateStart(type, childId, startedAt);

        if (timer.serverTimerId !== undefined) {
          updateTimerStart(
            { serverTimerId: timer.serverTimerId, startedAt },
            {
              onError: (error) => {
                // Left local-only: the next 60s poll will pull the server's
                // stale start back in unless a later edit or a retry succeeds.
                console.warn('[timers] could not update the server timer start:', error);
              },
            },
          );
        }
      },
    }),
    [startTimer, stopServerTimer, updateTimerStart],
  );
}
