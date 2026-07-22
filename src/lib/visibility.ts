/**
 * Which children show on the dashboard, and in what accent colour — pure logic
 * over the client-only `kidsStore` state. Baby Buddy's server has no concept of
 * visibility, groups, or colours, so all of this is device-local and layered on
 * top of the normalized `Child` here rather than on the `Child` type itself.
 *
 * These functions are pure and take `now` as an argument (like `medication.ts`
 * and `notifications.ts`) so they're unit-testable with no React or store. The
 * store extends `KidsVisibilityState` with actions + persistence.
 */
import type { Child } from '../api/types';

/** 0 = Sunday … 6 = Saturday, matching `Date.getDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * A recurring daily hide window. Minutes are minutes-from-midnight in local
 * time. `weekdays` restricts which days the window applies to; an **empty**
 * array means every day. When `startMinute > endMinute` the window wraps past
 * midnight (e.g. 22:00–06:00), evaluated against the same weekday.
 */
export interface VisibilitySchedule {
  startMinute: number;
  endMinute: number;
  weekdays: Weekday[];
}

/** A user-defined group of children with an optional colour + hide behaviour. */
export interface KidGroup {
  id: string;
  name: string;
  /** Accent hue (0–360) applied to members that don't override it. */
  accentHue?: number;
  /** Manually hide the whole group. */
  hidden?: boolean;
  schedule?: VisibilitySchedule;
  /** Sort order in the groups list. */
  order: number;
}

/**
 * The durable visibility/appearance state the pure functions read. The store
 * adds `knownChildIds` + `shakeReveal` + actions on top of this.
 */
export interface KidsVisibilityState {
  /** childId -> manually hidden. */
  hidden: Record<string, boolean>;
  /** childId -> groupId (a child belongs to at most one group). */
  childGroupId: Record<string, string>;
  /** childId -> accent hue override (wins over the group's colour). */
  childAccent: Record<string, number>;
  /** childId -> per-child hide schedule. */
  childSchedule: Record<string, VisibilitySchedule>;
  groups: Record<string, KidGroup>;
  /** Visibility applied to children first seen after the user set this. */
  defaultVisibility: 'visible' | 'hidden';
}

/**
 * Is a recurring hide window active at `now`?
 *
 * - Empty `weekdays` means every day.
 * - A `start === end` window is degenerate (never active).
 * - `start > end` wraps past midnight and is active late-night OR early-morning
 *   of a selected weekday.
 */
export function isScheduleActive(schedule: VisibilitySchedule, now: number): boolean {
  const { startMinute, endMinute, weekdays } = schedule;
  if (startMinute === endMinute) return false;

  const d = new Date(now);
  const weekday = d.getDay() as Weekday;
  if (weekdays.length > 0 && !weekdays.includes(weekday)) return false;

  const minute = d.getHours() * 60 + d.getMinutes();
  return startMinute < endMinute
    ? minute >= startMinute && minute < endMinute
    : minute >= startMinute || minute < endMinute;
}

/** The group a child belongs to, or undefined. */
export function groupForChild(
  childId: string,
  state: Pick<KidsVisibilityState, 'childGroupId' | 'groups'>,
): KidGroup | undefined {
  const groupId = state.childGroupId[childId];
  return groupId ? state.groups[groupId] : undefined;
}

/**
 * The accent hue to paint this child with. Precedence:
 * child override → group colour → the child's own default `hue`. Takes only the
 * colour slices so a card can subscribe to those without re-rendering on every
 * unrelated visibility change.
 */
export function effectiveHue(
  child: Child,
  state: Pick<KidsVisibilityState, 'childAccent' | 'childGroupId' | 'groups'>,
): number {
  const override = state.childAccent[child.id];
  if (override != null) return override;
  const group = groupForChild(child.id, state);
  if (group?.accentHue != null) return group.accentHue;
  return child.hue;
}

/** The state slices that determine whether a child is hidden. */
export type HiddenState = Pick<
  KidsVisibilityState,
  'hidden' | 'childGroupId' | 'groups' | 'childSchedule'
>;

/**
 * Is this child currently hidden from the dashboard? True if manually hidden,
 * in a hidden group, or inside an active per-child or group schedule window.
 * Reveal (shake / "show hidden") is applied by the caller, not here, so this
 * stays a pure function of `state` and `now`.
 */
export function isChildHidden(child: Child, state: HiddenState, now: number): boolean {
  if (state.hidden[child.id]) return true;

  const group = groupForChild(child.id, state);
  if (group?.hidden) return true;

  const childSchedule = state.childSchedule[child.id];
  if (childSchedule && isScheduleActive(childSchedule, now)) return true;
  if (group?.schedule && isScheduleActive(group.schedule, now)) return true;

  return false;
}

/**
 * The children to render on the dashboard, in input order. When a reveal is
 * active every child is shown; otherwise hidden children are filtered out.
 */
export function visibleChildren(
  children: Child[],
  state: HiddenState,
  now: number,
  revealActive: boolean,
): Child[] {
  if (revealActive) return children;
  return children.filter((child) => !isChildHidden(child, state, now));
}

/** How many children are currently hidden — drives the "show hidden" affordance. */
export function hiddenCount(children: Child[], state: HiddenState, now: number): number {
  return children.reduce((n, child) => (isChildHidden(child, state, now) ? n + 1 : n), 0);
}

/** Ids of children present now but not yet recorded in `knownChildIds`. */
export function newChildIds(children: Child[], knownChildIds: string[]): string[] {
  const known = new Set(knownChildIds);
  return children.map((c) => c.id).filter((id) => !known.has(id));
}
