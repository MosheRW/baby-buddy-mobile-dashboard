/**
 * Per-child dashboard visibility + appearance. Client-only, device-local
 * (Baby Buddy has no concept of hiding, grouping, or colouring children), so
 * this lives in Zustand and is persisted to AsyncStorage — never on the server
 * or the `Child` type.
 *
 * The full shape (groups / accents / schedules / shake) is defined now even
 * though the UI is built in phases, so later phases wire controls to existing
 * actions without a storage migration — the same approach `notificationStore`
 * took with its deferred cases.
 *
 * The pure visibility/colour math reads `KidsVisibilityState` (see
 * `src/lib/visibility.ts`); this store extends it with `knownChildIds`,
 * `shakeReveal`, and actions. The transient "reveal hidden kids for N minutes"
 * state deliberately lives in `uiStore`, not here — it's session-only.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorage } from './storage';
import type { KidsVisibilityState, VisibilitySchedule } from '../lib/visibility';

export type { KidGroup, VisibilitySchedule, Weekday } from '../lib/visibility';

interface KidsState extends KidsVisibilityState {
  /** Child ids already seen, so genuinely new children can be detected. */
  knownChildIds: string[];
  /** Shake-to-reveal preference (the gesture itself lives in a hook). */
  shakeReveal: { enabled: boolean; durationMinutes: number };

  setHidden: (childId: string, hidden: boolean) => void;
  setDefaultVisibility: (value: 'visible' | 'hidden') => void;
  registerKnownChildren: (ids: string[]) => void;

  setChildGroup: (childId: string, groupId: string | null) => void;
  setChildAccent: (childId: string, hue: number | null) => void;
  setChildSchedule: (childId: string, schedule: VisibilitySchedule | null) => void;

  addGroup: (name: string) => string;
  renameGroup: (groupId: string, name: string) => void;
  setGroupAccent: (groupId: string, hue: number | null) => void;
  setGroupHidden: (groupId: string, hidden: boolean) => void;
  setGroupSchedule: (groupId: string, schedule: VisibilitySchedule | null) => void;
  removeGroup: (groupId: string) => void;

  setShakeReveal: (patch: Partial<{ enabled: boolean; durationMinutes: number }>) => void;
}

/** Remove a key from a record without mutating the original. */
function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!(key in record)) return record;
  const { [key]: _removed, ...rest } = record;
  return rest;
}

export const useKidsStore = create<KidsState>()(
  persist(
    (set, get) => ({
      hidden: {},
      childGroupId: {},
      childAccent: {},
      childSchedule: {},
      groups: {},
      defaultVisibility: 'visible',
      knownChildIds: [],
      shakeReveal: { enabled: true, durationMinutes: 5 },

      setHidden: (childId, hidden) =>
        set((state) => ({ hidden: { ...state.hidden, [childId]: hidden } })),

      setDefaultVisibility: (value) => set({ defaultVisibility: value }),

      registerKnownChildren: (ids) =>
        set((state) => {
          const merged = new Set(state.knownChildIds);
          for (const id of ids) merged.add(id);
          return { knownChildIds: [...merged] };
        }),

      setChildGroup: (childId, groupId) =>
        set((state) => ({
          childGroupId:
            groupId == null
              ? omit(state.childGroupId, childId)
              : { ...state.childGroupId, [childId]: groupId },
        })),

      setChildAccent: (childId, hue) =>
        set((state) => ({
          childAccent:
            hue == null ? omit(state.childAccent, childId) : { ...state.childAccent, [childId]: hue },
        })),

      setChildSchedule: (childId, schedule) =>
        set((state) => ({
          childSchedule:
            schedule == null
              ? omit(state.childSchedule, childId)
              : { ...state.childSchedule, [childId]: schedule },
        })),

      addGroup: (name) => {
        // App-runtime id; uniqueness only needs to hold within one device.
        const id = `g${Date.now().toString(36)}${Object.keys(get().groups).length}`;
        set((state) => ({
          groups: {
            ...state.groups,
            [id]: { id, name, order: Object.keys(state.groups).length },
          },
        }));
        return id;
      },

      renameGroup: (groupId, name) =>
        set((state) =>
          state.groups[groupId]
            ? { groups: { ...state.groups, [groupId]: { ...state.groups[groupId], name } } }
            : state,
        ),

      setGroupAccent: (groupId, hue) =>
        set((state) =>
          state.groups[groupId]
            ? {
                groups: {
                  ...state.groups,
                  [groupId]: { ...state.groups[groupId], accentHue: hue ?? undefined },
                },
              }
            : state,
        ),

      setGroupHidden: (groupId, hidden) =>
        set((state) =>
          state.groups[groupId]
            ? { groups: { ...state.groups, [groupId]: { ...state.groups[groupId], hidden } } }
            : state,
        ),

      setGroupSchedule: (groupId, schedule) =>
        set((state) =>
          state.groups[groupId]
            ? {
                groups: {
                  ...state.groups,
                  [groupId]: { ...state.groups[groupId], schedule: schedule ?? undefined },
                },
              }
            : state,
        ),

      removeGroup: (groupId) =>
        set((state) => {
          // Drop the group and detach any children pointing at it.
          const childGroupId: Record<string, string> = {};
          for (const [childId, gid] of Object.entries(state.childGroupId)) {
            if (gid !== groupId) childGroupId[childId] = gid;
          }
          return { groups: omit(state.groups, groupId), childGroupId };
        }),

      setShakeReveal: (patch) =>
        set((state) => ({ shakeReveal: { ...state.shakeReveal, ...patch } })),
    }),
    {
      name: 'kids',
      version: 1,
      storage: createJSONStorage(() => asyncStorage),
    },
  ),
);
