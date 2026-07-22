/**
 * App preferences: the per-child default feeding amount. (The dashboard
 * food-total window merged into the per-child feeding interval, which now lives
 * in `notificationStore` so it can be edited even with notifications off.)
 * Persisted to AsyncStorage.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorage } from './storage';

interface SettingsState {
  /** childId -> default feeding amount (ml). Falls back to the child's own default. */
  defaultFoodMl: Record<string, number>;
  setDefaultFoodMl: (childId: string, ml: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultFoodMl: {},
      setDefaultFoodMl: (childId, ml) =>
        set((state) => ({ defaultFoodMl: { ...state.defaultFoodMl, [childId]: ml } })),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => asyncStorage),
    },
  ),
);
