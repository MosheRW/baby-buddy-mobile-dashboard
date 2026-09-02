/**
 * Keeps the active i18next language in sync with the effective preference:
 * the user's explicit Settings override wins; otherwise the language from the
 * signed-in Baby Buddy profile; otherwise English. Mounted once, above the
 * navigator, so every screen renders in the right language from first paint.
 */
import { useEffect } from 'react';
import { useAuthStore, useLocaleStore } from '../stores';
import i18n, { changeAppLanguage, resolveProfileLanguage, type AppLanguage } from '../i18n';

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

/**
 * Resolve the effective language by reading the stores imperatively — the
 * non-hook equivalent of `useEffectiveLanguage`, for headless paths (the
 * background notification refresh) that have no React tree to run
 * `useSyncAppLanguage`.
 */
export function effectiveLanguage(): AppLanguage {
  const override = useLocaleStore.getState().override;
  const profileLanguage = useAuthStore.getState().session?.language;
  return override ?? resolveProfileLanguage(profileLanguage);
}

/**
 * Apply the effective language to i18next from outside React. Without this, a
 * plan built headlessly (`runScheduledNotificationSync`) renders every reminder
 * body against i18next's default language rather than the user's — English copy
 * for a Hebrew user. Awaitable so callers can be sure `i18n.t` sees the switched
 * language before they build; a no-op when it's already active.
 *
 * A failed `changeLanguage` (a corrupted persisted override, an i18n init edge
 * case) is swallowed with a warning: the worst outcome is a reminder built in the
 * currently-active language, which must never fail the whole headless notification
 * sync — scheduling English copy is far better than scheduling nothing.
 */
export async function applyEffectiveLanguage(): Promise<void> {
  const language = effectiveLanguage();
  if (i18n.language === language) return;
  try {
    await i18n.changeLanguage(language);
  } catch (err) {
    console.warn('[useAppLanguage] changeLanguage failed:', err);
  }
}
