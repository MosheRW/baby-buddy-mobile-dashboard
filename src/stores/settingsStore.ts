/**
 * App preferences: the per-child default feeding amount and the duration/time
 * format. (The dashboard food-total window merged into the per-child feeding
 * interval, which now lives in `notificationStore` so it can be edited even
 * with notifications off.) Persisted to AsyncStorage.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorage } from './storage';
import type { TimeFormat } from '../lib/timeFormat';

interface SettingsState {
  /** childId -> default feeding amount (ml). Falls back to the child's own default. */
  defaultFoodMl: Record<string, number>;
  /**
   * How durations and live timers render: `text` ("2h 30m", "05:03") or
   * `digital` ("2:30", "5:03"). Defaults to `text` — the original behaviour.
   */
  timeFormat: TimeFormat;
  setDefaultFoodMl: (childId: string, ml: number) => void;
  setTimeFormat: (format: TimeFormat) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultFoodMl: {},
      timeFormat: 'text',
      setDefaultFoodMl: (childId, ml) =>
        set((state) => ({ defaultFoodMl: { ...state.defaultFoodMl, [childId]: ml } })),
      setTimeFormat: (format) => set({ timeFormat: format }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => asyncStorage),
    },
  ),
);
