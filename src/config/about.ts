/**
 * About-screen configuration — the single place links live, so no URL is
 * hardcoded in a component.
 *
 * The free-form links (LinkedIn, web app, user manual, privacy policy) come from
 * `expo.extra.about` in `app.json`. The GitHub sub-URLs and the Play Store
 * listing are *derived* from the repository URL and the Android package, so they
 * are never repeated. An empty string means "not configured" — the About screen
 * simply hides that row.
 *
 * The donate link is deliberately NOT in `app.json` (which ships in every
 * bundle). It comes from `EXPO_PUBLIC_BUY_ME_A_COFFEE`, which Metro inlines at
 * build time — set only in the APK/GitHub EAS profile — so its URL is entirely
 * absent from the Play Store AAB.
 */
import Constants from 'expo-constants';

interface AboutExtra {
  /** Base repository URL, e.g. https://github.com/owner/repo. */
  repo?: string;
  linkedIn?: string;
  webApp?: string;
  userManual?: string;
  privacyPolicy?: string;
}

const extra = (Constants.expoConfig?.extra?.about ?? {}) as AboutExtra;

/** Drop any trailing slash so `${repo}/discussions` never doubles up. */
function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

const repo = trimSlash(extra.repo ?? '');
const androidPackage = Constants.expoConfig?.android?.package ?? '';

/** The installed app version, straight from the Expo config — never hardcoded. */
export const appVersion = Constants.expoConfig?.version ?? '';

/**
 * Every About-screen link, resolved once. Derived entries are empty when their
 * source (repo / package) is missing; configured entries are empty when left
 * blank in `app.json`. The screen hides any row whose URL is empty.
 */
export const aboutLinks = {
  repo,
  /** Version double-tap target: the release-announcement discussions category. */
  discussionsAnnouncements: repo ? `${repo}/discussions/categories/announcements` : '',
  discussions: repo ? `${repo}/discussions` : '',
  reportBug: repo ? `${repo}/issues/new` : '',
  playStore: androidPackage
    ? `https://play.google.com/store/apps/details?id=${androidPackage}`
    : '',
  linkedIn: extra.linkedIn ?? '',
  webApp: extra.webApp ?? '',
  userManual: extra.userManual ?? '',
  privacyPolicy: extra.privacyPolicy ?? '',
} as const;

/** URL shared by "Share this app" — the first configured of web app, store, repo. */
export const shareUrl = aboutLinks.webApp || aboutLinks.playStore || aboutLinks.repo;

/**
 * "Buy me a coffee" — compiled into non–Play Store builds only. The env var is
 * inlined at build time (set in the APK EAS profile, unset in the Play
 * `production` profile), so when it's absent the URL string isn't in the bundle
 * at all and this whole section never renders.
 */
export const donateUrl = process.env.EXPO_PUBLIC_BUY_ME_A_COFFEE ?? '';
export const donateEnabled = donateUrl !== '';
