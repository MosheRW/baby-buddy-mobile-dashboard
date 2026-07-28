/**
 * On-device data for the offline "local" login mode. When the user signs in
 * without a server, this store IS the backing table the local `DataSource`
 * (`localDataSource.ts`) reads and writes — children, entries and running
 * timers, persisted to AsyncStorage so nothing is lost across an app kill.
 *
 * It survives sign-out on purpose: logging out of offline mode must not throw
 * away the family's data, so re-entering offline mode picks up where it left off.
 *
 * The slice creator is exported separately from the persisted singleton so tests
 * can build a hermetic vanilla store with no AsyncStorage dependency.
 */
import { create, type StateCreator } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorage } from '../stores/storage';
import type { Child, Entry } from '../api/types';
import type { RunningTimer, TimerType } from '../lib/timers';
import { ageLabel, hueForChild } from '../api/normalize';

/** Fallback default feeding amount (ml), matching the server-mode default. */
const DEFAULT_FOOD_ML = 120;

export interface LocalChildInput {
  name: string;
  /** ISO 8601 birth date. */
  birthDate: string;
  defaultFoodMl?: number;
}

export interface LocalDataState {
  children: Child[];
  entries: Entry[];
  timers: RunningTimer[];
  /**
   * Monotonic counter feeding every id we mint — child ids, namespaced entry
   * ids, and timer ids — so a single sequence guarantees uniqueness across all
   * three without them ever colliding.
   */
  seq: number;

  // --- Children (managed from Settings) ---
  addChild: (input: LocalChildInput) => Child;
  updateChild: (
    id: string,
    patch: Partial<Pick<Child, 'name' | 'birthDate' | 'defaultFoodMl'>>,
  ) => void;
  /** Removing a child cascades to its entries and running timers. */
  removeChild: (id: string) => void;

  // --- Entries (driven by the local DataSource) ---
  insertEntry: (entry: Entry) => Entry;
  patchEntry: (entry: Entry) => Entry;
  removeEntry: (id: string) => void;

  // --- Timers (driven by the local DataSource) ---
  insertTimer: (type: TimerType, childId: string, startedAt: number) => RunningTimer;
  removeTimer: (serverTimerId: number) => void;
  patchTimerStart: (serverTimerId: number, startedAt: number) => RunningTimer | undefined;

  /** Wipe everything — used by tests, never wired to the UI. */
  reset: () => void;
}

function makeChild(id: number, input: LocalChildInput): Child {
  const name = input.name.trim() || 'Baby';
  return {
    id: String(id),
    name,
    initial: (name[0] ?? '?').toUpperCase(),
    // Deterministic hue from the id, same golden-angle spacing as server children.
    hue: hueForChild(id),
    birthDate: input.birthDate,
    age: ageLabel(input.birthDate),
    defaultFoodMl: input.defaultFoodMl ?? DEFAULT_FOOD_ML,
  };
}

const isPair = (t: RunningTimer, type: TimerType, childId: string) =>
  t.type === type && t.childId === childId;

export const createLocalDataSlice: StateCreator<LocalDataState> = (set, get) => ({
  children: [],
  entries: [],
  timers: [],
  seq: 0,

  addChild: (input) => {
    const id = get().seq + 1;
    const child = makeChild(id, input);
    set((s) => ({ seq: id, children: [...s.children, child] }));
    return child;
  },

  updateChild: (id, patch) =>
    set((s) => ({
      children: s.children.map((c) => {
        if (c.id !== id) return c;
        const name = patch.name?.trim() ? patch.name.trim() : c.name;
        const birthDate = patch.birthDate ?? c.birthDate;
        return {
          ...c,
          name,
          initial: (name[0] ?? '?').toUpperCase(),
          birthDate,
          age: ageLabel(birthDate),
          defaultFoodMl: patch.defaultFoodMl ?? c.defaultFoodMl,
        };
      }),
    })),

  removeChild: (id) =>
    set((s) => ({
      children: s.children.filter((c) => c.id !== id),
      entries: s.entries.filter((e) => e.childId !== id),
      timers: s.timers.filter((t) => t.childId !== id),
    })),

  insertEntry: (entry) => {
    const n = get().seq + 1;
    // Mint a namespaced id like the server ones (`{type}:{id}`), so nothing
    // downstream can tell a local entry from a server one by its id shape.
    const saved = { ...entry, id: `${entry.type}:${n}` } as Entry;
    set((s) => ({ seq: n, entries: [saved, ...s.entries] }));
    return saved;
  },

  patchEntry: (entry) => {
    set((s) => ({ entries: s.entries.map((e) => (e.id === entry.id ? entry : e)) }));
    return entry;
  },

  removeEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),

  insertTimer: (type, childId, startedAt) => {
    const n = get().seq + 1;
    const timer: RunningTimer = { type, childId, startedAt, serverTimerId: n };
    set((s) => ({
      seq: n,
      // One timer per (type, child), the same rule the app enforces locally.
      timers: [...s.timers.filter((t) => !isPair(t, type, childId)), timer],
    }));
    return timer;
  },

  removeTimer: (serverTimerId) =>
    set((s) => ({ timers: s.timers.filter((t) => t.serverTimerId !== serverTimerId) })),

  patchTimerStart: (serverTimerId, startedAt) => {
    set((s) => ({
      timers: s.timers.map((t) => (t.serverTimerId === serverTimerId ? { ...t, startedAt } : t)),
    }));
    return get().timers.find((t) => t.serverTimerId === serverTimerId);
  },

  reset: () => set({ children: [], entries: [], timers: [], seq: 0 }),
});

export const useLocalDataStore = create<LocalDataState>()(
  persist(createLocalDataSlice, {
    name: 'local-data',
    storage: createJSONStorage(() => asyncStorage),
    partialize: (state) => ({
      children: state.children,
      entries: state.entries,
      timers: state.timers,
      seq: state.seq,
    }),
  }),
);
