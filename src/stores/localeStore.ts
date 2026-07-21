/**
 * Language preference. `override` is the user's explicit choice from Settings;
 * `null` means "follow the profile's language" (the default). The effective
 * language is resolved in `useSyncAppLanguage` as `override ?? profile ?? en`.
 * Persisted to AsyncStorage so a manual choice survives restarts.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { asyncStorage } from './storage';
import type { AppLanguage } from '../i18n';

interface LocaleState {
  /** Explicit user choice, or null to follow the profile language. */
  override: AppLanguage | null;
  setLanguage: (lang: AppLanguage) => void;
  clearOverride: () => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      override: null,
      setLanguage: (lang) => set({ override: lang }),
      clearOverride: () => set({ override: null }),
    }),
    {
      name: 'locale',
      storage: createJSONStorage(() => asyncStorage),
    },
  ),
);
