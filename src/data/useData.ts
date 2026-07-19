/**
 * Phase 2 data loading. A thin useEffect/useState wrapper over `dataSource`.
 * Phase 5 replaces this with TanStack Query hooks (useChildren/useEntries) that
 * add caching, refetch-on-focus, and optimistic mutations.
 */
import { useCallback, useEffect, useState } from 'react';
import type { Child, Entry } from '../api/types';
import { dataSource } from './dataSource';

export function useDashboardData() {
  const [children, setChildren] = useState<Child[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [c, e] = await Promise.all([dataSource.getChildren(), dataSource.getEntries()]);
    setChildren(c);
    setEntries(e);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Async fetch: the setState calls happen after `await`, not synchronously.
    // This whole hook is replaced by TanStack Query in Phase 5.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return { children, entries, loading, refresh };
}
