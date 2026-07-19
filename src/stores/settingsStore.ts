/**
 * App preferences: the dashboard food-total window and per-child default
 * feeding amount. Persisted to AsyncStorage.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorage } from './storage';

interface SettingsState {
  foodWindowHours: number;
  /** childId -> default feeding amount (ml). Falls back to the child's own default. */
  defaultFoodMl: Record<string, number>;
  setFoodWindowHours: (hours: number) => void;
  setDefaultFoodMl: (childId: string, ml: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      foodWindowHours: 4,
      defaultFoodMl: {},
      setFoodWindowHours: (hours) => set({ foodWindowHours: hours }),
      setDefaultFoodMl: (childId, ml) =>
        set((state) => ({ defaultFoodMl: { ...state.defaultFoodMl, [childId]: ml } })),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => asyncStorage),
    },
  ),
);
