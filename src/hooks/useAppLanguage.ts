/**
 * Keeps the active i18next language in sync with the effective preference:
 * the user's explicit Settings override wins; otherwise the language from the
 * signed-in Baby Buddy profile; otherwise English. Mounted once, above the
 * navigator, so every screen renders in the right language from first paint.
 */
import { useEffect } from 'react';
import { useAuthStore, useLocaleStore } from '../stores';
import { changeAppLanguage, resolveProfileLanguage, type AppLanguage } from '../i18n';

/** The language that should currently be active, given override + profile. */
export function useEffectiveLanguage(): AppLanguage {
  const override = useLocaleStore((s) => s.override);
  const profileLanguage = useAuthStore((s) => s.session?.language);
  return override ?? resolveProfileLanguage(profileLanguage);
}

/** Applies the effective language to i18next whenever it changes. */
export function useSyncAppLanguage(): void {
  const language = useEffectiveLanguage();
  useEffect(() => {
    changeAppLanguage(language);
  }, [language]);
}
