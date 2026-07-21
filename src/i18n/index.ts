/**
 * App i18n. A single i18next instance, initialized **synchronously on import**
 * so that pure helpers in `src/lib` and `src/api` can call `i18n.t(...)` the
 * moment they run — including under Jest, where no provider is mounted. Resources
 * are inlined (no async backend), which is what makes the init synchronous.
 *
 * Components use react-i18next's `useTranslation()`; because they subscribe to
 * language changes, switching the language re-renders the tree and every label —
 * including those produced by the pure helpers — is recomputed.
 */
/* eslint-disable import/no-named-as-default-member -- i18next's default export
   intentionally carries these methods (use/changeLanguage/dir); that is the
   documented API, not an accidental named-export mix-up. */
// Hermes (the RN engine) ships no `Intl.PluralRules`, so without this polyfill
// i18next silently falls back to its v3 plural format and our CLDR v4 plural
// keys (`_one`/`_two`/`_many`/`_other`) stop resolving — Hebrew ages/doses break
// on-device even though Node/Jest (which has Intl) looks fine. Must be imported
// before i18n.init below.
import 'intl-pluralrules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './locales/en';
import { he } from './locales/he';

export type AppLanguage = 'en' | 'he';

/** The languages the picker offers, in display order. */
export const SUPPORTED_LANGUAGES: AppLanguage[] = ['en', 'he'];

const DEFAULT_LANGUAGE: AppLanguage = 'en';

/**
 * Map a Baby Buddy profile language code (Django `LANGUAGE_CODE`, e.g. "en-us",
 * "he", "fr") onto a language the app actually ships. Unknown codes fall back to
 * English rather than showing raw keys.
 */
export function resolveProfileLanguage(code?: string | null): AppLanguage {
  if (!code) return DEFAULT_LANGUAGE;
  const base = code.toLowerCase().split(/[-_]/)[0];
  return (SUPPORTED_LANGUAGES as string[]).includes(base) ? (base as AppLanguage) : DEFAULT_LANGUAGE;
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      he: { translation: he },
    },
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    // Inline resources → init completes synchronously, so `t` works right away.
    initImmediate: false,
    returnNull: false,
    interpolation: {
      // React Native already renders text safely; no HTML escaping needed.
      escapeValue: false,
    },
  });
}

/** Switch the active language (no-op if already set). */
export function changeAppLanguage(lang: AppLanguage): void {
  if (i18n.language !== lang) {
    void i18n.changeLanguage(lang);
  }
}

/** Text direction for the active language ('rtl' for Hebrew). */
export function currentDirection(): 'ltr' | 'rtl' {
  return i18n.dir();
}

export default i18n;
