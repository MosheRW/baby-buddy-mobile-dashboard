/**
 * Appearance preference. `'system'` (the default) follows the OS setting;
 * `'light'` / `'dark'` pin the app regardless of it. Persisted to AsyncStorage
 * so a manual choice survives restarts.
 *
 * Deliberately stores the *preference*, not the resolved scheme — persisting
 * the resolved value would freeze a `'system'` user to whatever the OS happened
 * to be on the day they last opened the app. Resolution happens at render, in
 * `useEffectiveScheme`.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorage } from './storage';

export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCES: ThemePreference[] = ['system', 'light', 'dark'];

interface ThemeState {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference: (preference) => set({ preference }),
    }),
    {
      name: 'theme',
      storage: createJSONStorage(() => asyncStorage),
    },
  ),
);
