/**
 * App preferences: the per-child default feeding amount, plus the
 * exclude-inactive-days statistics toggle. (The dashboard food-total window
 * merged into the per-child feeding interval, which now lives in
 * `notificationStore` so it can be edited even with notifications off.)
 * Persisted to AsyncStorage.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorage } from './storage';

interface SettingsState {
  /** childId -> default feeding amount (ml). Falls back to the child's own default. */
  defaultFoodMl: Record<string, number>;
  /**
   * Drop days with no logged entries from the day-averaged statistics (the
   * food-trend baseline and the feed-card gauges). Off by default, so a fresh
   * install behaves exactly as before; the dashboard banner offers to turn it on
   * the first time an inactive day is detected.
   */
  excludeInactiveDays: boolean;
  /**
   * Whether the one-time "exclude inactive days?" banner has been answered.
   * Persisted so it doesn't reappear on every launch once dismissed.
   */
  inactiveDaysPromptSeen: boolean;
  setDefaultFoodMl: (childId: string, ml: number) => void;
  setExcludeInactiveDays: (value: boolean) => void;
  markInactiveDaysPromptSeen: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultFoodMl: {},
      excludeInactiveDays: false,
      inactiveDaysPromptSeen: false,
      setDefaultFoodMl: (childId, ml) =>
        set((state) => ({ defaultFoodMl: { ...state.defaultFoodMl, [childId]: ml } })),
      // Answering via the banner also counts as seeing it, so both actions mark
      // it seen.
      setExcludeInactiveDays: (value) =>
        set({ excludeInactiveDays: value, inactiveDaysPromptSeen: true }),
      markInactiveDaysPromptSeen: () => set({ inactiveDaysPromptSeen: true }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => asyncStorage),
    },
  ),
);
