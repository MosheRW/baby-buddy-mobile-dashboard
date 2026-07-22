/**
 * Applies the "default visibility for new children" preference. When children
 * load, any id not yet in `knownChildIds` is a child first seen now: if the
 * default is `hidden`, it starts hidden; either way it's recorded as known.
 *
 * Idempotent via `knownChildIds` — it fires once per genuinely new child and
 * never re-hides one the user has since unhidden. On a fresh install the first
 * load simply records every existing child as known (default is `visible`), so
 * switching the default to `hidden` later only affects children added after.
 *
 * Mounted once in `RootNavigator`, alongside the other app-wide sync hooks.
 */
import { useEffect } from 'react';
import { useChildren } from '../data/queries';
import { useKidsStore } from '../stores';
import { newChildIds } from '../lib/visibility';

export function useApplyDefaultVisibility(): void {
  const { data: children } = useChildren();
  const knownChildIds = useKidsStore((s) => s.knownChildIds);
  const defaultVisibility = useKidsStore((s) => s.defaultVisibility);
  const setHidden = useKidsStore((s) => s.setHidden);
  const registerKnownChildren = useKidsStore((s) => s.registerKnownChildren);

  useEffect(() => {
    if (!children || children.length === 0) return;
    const fresh = newChildIds(children, knownChildIds);
    if (fresh.length === 0) return;

    if (defaultVisibility === 'hidden') {
      for (const id of fresh) setHidden(id, true);
    }
    registerKnownChildren(children.map((c) => c.id));
  }, [children, knownChildIds, defaultVisibility, setHidden, registerKnownChildren]);
}
