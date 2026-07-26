/**
 * Server state lives here, in TanStack Query — never in Zustand (which holds
 * only client state: session, settings, timers, form draft).
 *
 * Mutations invalidate rather than hand-patch the cache: entry writes can change
 * derived dashboard values (time-since, food totals, medication windows) in ways
 * that are simpler to recompute from a refetch than to replicate optimistically.
 */
import { useMemo } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import type { Child, Entry } from '../api/types';
import type { RunningTimer, TimerType } from '../lib/timers';
import { useAuthStore } from '../stores/authStore';
import { useAppErrorStore } from '../stores/appErrorStore';
import { errorMessage } from '../api/client';
import { dataSource } from './dataSource';

export const queryKeys = {
  children: ['children'] as const,
  entries: ['entries'] as const,
  timers: ['timers'] as const,
};

/** Signed-out users have nothing to fetch; queries stay disabled until then. */
function useEnabled(): boolean {
  return useAuthStore((s) => s.session !== null);
}

/**
 * Query definitions live as standalone objects because they have two callers: the
 * hooks below, and `refreshServerData`, which fetches the same three imperatively
 * for notification validation. Sharing the object keeps the fetch the validator
 * performs identical to the one the UI performs.
 */
const childrenQuery = {
  queryKey: queryKeys.children,
  queryFn: ({ signal }: { signal: AbortSignal }) => dataSource.getChildren(signal),
  // Children change rarely; entries are what actually move.
  staleTime: 5 * 60_000,
};

const entriesQuery = {
  queryKey: queryKeys.entries,
  queryFn: ({ signal }: { signal: AbortSignal }) => dataSource.getEntries(signal),
  staleTime: 30_000,
};

const timersQuery = {
  queryKey: queryKeys.timers,
  queryFn: ({ signal }: { signal: AbortSignal }) => dataSource.getTimers(signal),
  staleTime: 30_000,
};

export function useChildren() {
  const enabled = useEnabled();
  return useQuery({ ...childrenQuery, enabled });
}

export function useEntries() {
  const enabled = useEnabled();
  return useQuery({ ...entriesQuery, enabled });
}

/**
 * Fetch entries, children and timers straight from the server, bypassing staleness
 * (`staleTime: 0` forces a real request), and report whether the server actually
 * answered. Used by the notification layer, which must not build or deliver a
 * reminder from cached data it hasn't confirmed.
 *
 * Returns `false` — never throws — on any failure, including a signed-out session:
 * the caller's job is to decide what to do without confirmation, not to handle a
 * network error. Results land in the normal cache, so the UI benefits too.
 */
export async function refreshServerData(client: QueryClient): Promise<boolean> {
  if (useAuthStore.getState().session === null) return false;
  try {
    await Promise.all([
      client.fetchQuery({ ...entriesQuery, staleTime: 0 }),
      client.fetchQuery({ ...childrenQuery, staleTime: 0 }),
      client.fetchQuery({ ...timersQuery, staleTime: 0 }),
    ]);
    return true;
  } catch {
    return false;
  }
}

export interface DashboardData {
  children: Child[];
  entries: Entry[];
  isLoading: boolean;
  /** True while refetching an already-populated cache (pull-to-refresh, focus). */
  isRefreshing: boolean;
  error: unknown;
  refetch: () => void;
}

const NO_CHILDREN: Child[] = [];
const NO_ENTRIES: Entry[] = [];

/**
 * The dashboard's data. Same shape the Phase 2–4 hook exposed, so screens didn't
 * have to change when the mock provider was replaced.
 */
export function useDashboardData(): DashboardData {
  const children = useChildren();
  const entries = useEntries();

  return useMemo(
    () => ({
      children: children.data ?? NO_CHILDREN,
      entries: entries.data ?? NO_ENTRIES,
      isLoading: children.isPending || entries.isPending,
      isRefreshing: children.isFetching || entries.isFetching,
      error: children.error ?? entries.error,
      refetch: () => {
        void children.refetch();
        void entries.refetch();
      },
    }),
    [children, entries],
  );
}

/** Invalidate everything an entry write can affect. */
function useInvalidateEntries() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: queryKeys.entries });
  };
}

export function useSaveEntry(): UseMutationResult<Entry, unknown, Entry> {
  const invalidate = useInvalidateEntries();
  const pushError = useAppErrorStore((s) => s.pushError);
  const dismissError = useAppErrorStore((s) => s.dismissError);
  return useMutation({
    mutationFn: (entry: Entry) =>
      // A namespaced id means the server already knows this entry.
      entry.id ? dataSource.updateEntry(entry) : dataSource.createEntry(entry),
    onSuccess: () => {
      // A save that lands clears a lingering "couldn't save" card from an
      // earlier attempt (the form shows the live error inline while open; this
      // is the copy that outlives the modal on the dashboard carousel).
      dismissError('save-entry');
      invalidate();
    },
    onError: (err, entry) => {
      pushError({
        id: 'save-entry',
        titleKey: 'errors.saveTitle',
        message: errorMessage(err),
        childId: entry.childId,
      });
    },
  });
}

export function useDeleteEntry(): UseMutationResult<void, unknown, string> {
  const invalidate = useInvalidateEntries();
  const pushError = useAppErrorStore((s) => s.pushError);
  const dismissError = useAppErrorStore((s) => s.dismissError);
  return useMutation({
    mutationFn: (id: string) => dataSource.deleteEntry(id),
    onSuccess: () => {
      dismissError('delete-entry');
      invalidate();
    },
    onError: (err) => {
      pushError({
        id: 'delete-entry',
        titleKey: 'errors.deleteTitle',
        message: errorMessage(err),
      });
    },
  });
}

/**
 * Timers running on the server. Polled rather than pushed — Baby Buddy has no
 * websocket, and a timer another caregiver stopped should still disappear here
 * within a minute or so.
 */
export function useServerTimers() {
  const enabled = useEnabled();
  return useQuery({
    ...timersQuery,
    enabled,
    refetchInterval: 60_000,
    // A timer failing to load must not surface as a dashboard error — the
    // local copy keeps running and `reconcileTimers` simply has nothing to add.
    retry: 1,
  });
}

export interface StartTimerVars {
  type: TimerType;
  childId: string;
  startedAt: number;
}

export function useStartTimer(): UseMutationResult<RunningTimer, unknown, StartTimerVars> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ type, childId, startedAt }: StartTimerVars) =>
      dataSource.startTimer(type, childId, startedAt),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: queryKeys.timers });
    },
  });
}

export function useStopTimer(): UseMutationResult<void, unknown, number> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (serverTimerId: number) => dataSource.stopTimer(serverTimerId),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: queryKeys.timers });
    },
  });
}

export interface UpdateTimerStartVars {
  serverTimerId: number;
  startedAt: number;
}

export function useUpdateTimerStart(): UseMutationResult<
  RunningTimer,
  unknown,
  UpdateTimerStartVars
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ serverTimerId, startedAt }: UpdateTimerStartVars) =>
      dataSource.updateTimerStart(serverTimerId, startedAt),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: queryKeys.timers });
    },
  });
}
