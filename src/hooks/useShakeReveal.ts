/**
 * Wires the shake gesture to the "reveal hidden children" window. Only listens
 * when the preference is on AND at least one child is actually hidden, so the
 * accelerometer isn't running for nothing. A shake opens the reveal window in
 * `uiStore` for the configured duration; the dashboard shows every child while
 * it's open. Mounted once in `RootNavigator`.
 */
import { useChildren } from '../data/queries';
import { useKidsStore, useUiStore } from '../stores';
import { hiddenCount } from '../lib/visibility';
import { useMinuteTick } from './useTick';
import { useShakeDetector } from './useShakeDetector';

export function useShakeReveal(): void {
  const { data: children } = useChildren();
  const enabledPref = useKidsStore((s) => s.shakeReveal.enabled);
  const durationMinutes = useKidsStore((s) => s.shakeReveal.durationMinutes);
  const hidden = useKidsStore((s) => s.hidden);
  const childGroupId = useKidsStore((s) => s.childGroupId);
  const childSchedule = useKidsStore((s) => s.childSchedule);
  const groups = useKidsStore((s) => s.groups);
  const revealHidden = useUiStore((s) => s.revealHidden);

  const now = useMinuteTick();
  const count = children
    ? hiddenCount(children, { hidden, childGroupId, childSchedule, groups }, now)
    : 0;
  const active = enabledPref && count > 0;

  useShakeDetector(() => revealHidden(durationMinutes * 60_000), active);
}
