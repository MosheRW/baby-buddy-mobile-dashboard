# Baby Buddy Dashboard — React Native (Android)

A mobile dashboard client for a self-hosted [Baby Buddy](https://github.com/babybuddy/babybuddy) server (direct or via the Home Assistant add-on). Caregivers log diapers, feedings, medications, temperature, tummy time, and sleep for one or more children, see time-since-last stats and medication due/eligible windows, and run background timers.

**Design source of truth:** `design_handoff_react_native_app/README.md` (high-fidelity — colors, spacing, radii, copy, and interaction flows are final) **plus `CHANGES_SINCE_LAST_HANDOFF.md`, which supersedes it in the spots it lists** — the README was never refreshed after the prototype's 4-batch refactor, so read the two together. The interactive prototype `Baby Buddy Dashboard App.dc.html` is the behavioral reference; open it in a browser to verify conditional logic. Screenshots in `design_handoff_react_native_app/screenshots/` predate the refactor. Where the docs and the prototype disagree, **the prototype wins** (it corrected two spec errors — see `docs/DESIGN_REFRESH_PLAN.md` §1b).

**Build plan:** `docs/IMPLEMENTATION_PLAN.md` — phases, package rationale, API notes.

## Tech stack (decided — don't substitute without asking)

- **Expo** (managed workflow, latest SDK) + **TypeScript** (strict). Android is the only target for now.
- **React Navigation** (native stack) — 4 screens + modal sheet; no Expo Router.
- **Zustand** for client state (auth session, settings, running timers, form draft).
- **TanStack Query (React Query)** for all server state (children, entries) — no entries in Zustand.
- **AsyncStorage** for preferences; **expo-secure-store** for tokens/credentials.
- `@react-native-community/datetimepicker` for date/time fields.
- `@expo-google-fonts/nunito` + `expo-font` for typography.
- `react-native-svg` for the minimal geometric glyphs (custom-drawn, no icon library — pending design-owner sign-off, see plan).
- Jest + React Native Testing Library for tests.

## Project conventions

- All colors, spacing, radii, type sizes come from `src/theme/tokens.ts` — never hardcode a hex or px value in a component. Token values come from the handoff README's Design Tokens section (OKLCH already converted to hex there).
- Spacing scale only: 6/8/10/12/14/16/18/20/22/26/30. Radii: 8/10/12/14/16/20/24.
- Font weights map: 600 body, 700 chips/medium, 800 headings/buttons/values.
- Server data is normalized at the API-client boundary into internal entry shapes (`src/api/types.ts`); UI code never sees raw Baby Buddy or Home Assistant response shapes.
- Medication due/eligible math and feed grouping live in pure functions under `src/lib/` with unit tests — no date math inline in components.
- Timers are app-global state keyed by `{type, childId}`, persisted, and preferably backed by Baby Buddy's server-side timer endpoints — never form-local.
- Diaper Pee/Poo are two independent booleans (both can be on), not a segmented control.

## Commands

- `npx expo start` — dev server (press `a` for Android emulator).
- `npm test` — Jest.
- `npm run lint` / `npm run typecheck` — ESLint / `tsc --noEmit`.
- `npm run test:live` — integration suite against a real Baby Buddy server. Needs gitignored `.env.local` with `BABYBUDDY_URL` + `BABYBUDDY_TOKEN`; skips cleanly without it and is excluded from `npm test`. Uses its own `jest.integration.config.js` (plain node env — the jest-expo preset installs an Expo `FetchResponse` polyfill with no `.status`/`.ok`, which makes every request look like a failure).
- Quick visual QA without an emulator: `npx expo export --platform web --output-dir <dir>` then serve it, or `npx expo start --web`. `react-dom`/`react-native-web` are installed for this preview path only (target stays Android). On web, Reanimated's animation loop can make browser screenshots time out — verify via DOM text if so.
- **Web can only run against `USE_MOCK_DATA`.** Baby Buddy sends no `Access-Control-Allow-Origin`, so a browser blocks every API response. Real-server testing means Expo Go or a device build.


## Status & project notes

Full development history, per-feature design rationale, and implementation gotchas (auth/CSRF, server-time rules, i18n, notifications, kids visibility, dark mode, dynamic colour, etc.) live in **`docs/PROJECT_NOTES.md`** — read it before working on any of those areas.

Reanimated 4 requires `react-native-worklets/plugin` in `babel.config.js` (already set). Its Jest mock is deliberately omitted from `jest.setup.js` until a test renders an animated component (it fails eagerly under jsdom otherwise).

`react-native-worklets` is pinned to an **exact** version (no caret) because the Babel plugin stamps `__pluginVersion` onto every worklet and the runtime throws `[Worklets] Mismatch between JavaScript code version and Worklets Babel plugin version` if it doesn't match the installed lib. Two ways to hit that: letting the version drift (always install it via `npx expo install`, which pins the SDK's version), or a stale Metro cache holding worklets transformed by the previous plugin. After any change to worklets/reanimated versions, start with `npx expo start -c` — a plain restart reuses the cache and the error persists.
