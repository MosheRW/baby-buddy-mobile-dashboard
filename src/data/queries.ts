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
  type UseMutationResult,
} from '@tanstack/react-query';
import type { Child, Entry } from '../api/types';
import { useAuthStore } from '../stores/authStore';
import { dataSource } from './dataSource';

export const queryKeys = {
  children: ['children'] as const,
  entries: ['entries'] as const,
};

/** Signed-out users have nothing to fetch; queries stay disabled until then. */
function useEnabled(): boolean {
  return useAuthStore((s) => s.session !== null);
}

export function useChildren() {
  const enabled = useEnabled();
  return useQuery({
    queryKey: queryKeys.children,
    queryFn: ({ signal }) => dataSource.getChildren(signal),
    enabled,
    // Children change rarely; entries are what actually move.
    staleTime: 5 * 60_000,
  });
}

export function useEntries() {
  const enabled = useEnabled();
  return useQuery({
    queryKey: queryKeys.entries,
    queryFn: ({ signal }) => dataSource.getEntries(signal),
    enabled,
    staleTime: 30_000,
  });
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
  return useMutation({
    mutationFn: (entry: Entry) =>
      // A namespaced id means the server already knows this entry.
      entry.id ? dataSource.updateEntry(entry) : dataSource.createEntry(entry),
    onSuccess: invalidate,
  });
}

export function useDeleteEntry(): UseMutationResult<void, unknown, string> {
  const invalidate = useInvalidateEntries();
  return useMutation({
    mutationFn: (id: string) => dataSource.deleteEntry(id),
    onSuccess: invalidate,
  });
}
