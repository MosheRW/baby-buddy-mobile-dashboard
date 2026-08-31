# Development

Contributor and build documentation for the Baby Buddy mobile dashboard. For what the app does and how to use it, see the [README](../README.md) and [user manual](USER_MANUAL.md).

## Contents

- [Tech stack](#tech-stack)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [Scripts](#scripts)
- [Web preview caveat](#web-preview-caveat)
- [Native features need a dev build](#native-features-need-a-dev-build)
- [Building a release](#building-a-release)
- [Configuration & data storage](#configuration--data-storage)
- [Project layout](#project-layout)
- [Testing](#testing)
- [Troubleshooting (development)](#troubleshooting-development)

## Tech stack

- **Expo** (managed workflow) + **TypeScript** (strict). Android is the primary target; iOS and a web preview exist for development.
- **React Navigation** (native stack).
- **Zustand** for client state (auth session, settings, running timers, form drafts).
- **TanStack Query** for all server state (children, entries, timers).
- **AsyncStorage** for preferences; **expo-secure-store** for tokens/credentials.
- **react-native-svg** for the custom geometric glyphs; **@expo-google-fonts/nunito** for typography.
- **i18next / react-i18next** for English + Hebrew.
- **Jest** + **React Native Testing Library** for tests.

Design source of truth: `design_handoff_react_native_app/README.md` plus `CHANGES_SINCE_LAST_HANDOFF.md`. Build plan: [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md). Architecture notes and conventions: [`../CLAUDE.md`](../CLAUDE.md).

## Requirements

- **Node.js** 18+ and **npm**.
- **Expo** tooling (via `npx`, no global install needed).
- For device/emulator builds: **Android Studio** + an emulator, or a physical device with **Expo Go** (JS-only features) or a **dev build** (native features like notifications).
- A reachable **Baby Buddy server** for the online modes — or none at all for offline mode.

## Getting started

```bash
npm install
npx expo start
```

Press **`a`** to open the Android emulator, or scan the QR code with **Expo Go** on your device.

## Scripts

```bash
npm start          # expo start (dev server)
npm run android    # native Android build + run (expo run:android)
npm run web        # web preview (mock data only — see below)
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Jest unit tests
npm run test:live  # integration tests against a real server (needs .env.local)
```

## Web preview caveat

`npm run web` is a QA convenience only and **only works with mock data**. Baby Buddy sends no `Access-Control-Allow-Origin` header, so a browser blocks every real API response. To exercise a real server, use Expo Go or a device build. Toggle `USE_MOCK_DATA` in [`../src/data/dataSource.ts`](../src/data/dataSource.ts) to run on fixtures.

## Native features need a dev build

Local notifications, the live chronometer notification, background refresh, shake-to-reveal on some devices, and Material You dynamic colour rely on native modules. They are **no-ops in Expo Go and on web** and require a prebuild + dev/EAS build:

```bash
npx expo prebuild --platform android
npx expo run:android
```

After changing Reanimated/Worklets versions, start with a clean cache: `npx expo start -c`.

## Building a release

An EAS build is the supported path for a shippable APK/AAB with all native modules linked:

```bash
npm install -g eas-cli   # if you don't have it (or run via: npx eas ...)
eas build --platform android
```

Release APKs are published on the [GitHub Releases](https://github.com/MosheRW/baby-buddy-native/releases) page. The app id / package is `com.babybuddy.dashboard` (Android) and `com.mosherw.babybuddy` (iOS); the version is set in [`../app.json`](../app.json) and [`../package.json`](../package.json).

## Configuration & data storage

- **Tokens & credentials** — stored with `expo-secure-store` (falls back to `AsyncStorage` on web). Only the API token is ever kept; passwords are used once to bootstrap a token and then discarded.
- **Preferences** (theme, language, food defaults, notification toggles, kid visibility/groups, timers, form drafts) — persisted with `AsyncStorage` via Zustand stores in [`../src/stores/`](../src/stores).
- **Offline data** — children, entries, and timers live entirely on the device in the local data store.
- **Server state** (children, entries, timers when online) — fetched and cached with TanStack Query; never held in app state.
- **Live-test config** — `npm run test:live` reads a gitignored `.env.local` with `BABYBUDDY_URL` and `BABYBUDDY_TOKEN`; it skips cleanly when absent.

## Project layout

```
src/
  api/         Baby Buddy REST client, zod schemas, normalization, auth
  components/  Design-system primitives (AppText, Card, StatTile, buttons…) + glyphs
  data/        DataSource seam, TanStack Query hooks, local (offline) store
  features/    Screens grouped by area: auth, dashboard, logEntry, settings, …
  hooks/       Ticks, timers, notifications, language, shake detection
  i18n/        i18next setup + en/he locale files
  lib/         Pure, unit-tested logic: medication math, feed grouping, timers,
               notifications planner, contribution stats, dates, tags, visibility
  navigation/  React Navigation native stack + navigation ref
  notifications/ Native notification service, background task, rebuild
  stores/      Persisted Zustand stores (auth, settings, timers, kids, theme…)
  theme/       Design tokens, light/dark palettes, accent + dynamic colour
modules/       Local Expo native module: chronometer notification (Android/Kotlin)
docs/          Implementation plan, design-refresh plan, DEVELOPMENT.md, USER_MANUAL.md
design_handoff_react_native_app/  Original high-fidelity design source
```

## Testing

- **Unit tests** — `npm test` (Jest + React Native Testing Library). Pure logic in `src/lib` and the stores are heavily covered.
- **Type & lint** — `npm run typecheck` and `npm run lint`.
- **Live integration** — `npm run test:live` runs against a real Baby Buddy server (config in `.env.local`); it is excluded from the default suite.

## Troubleshooting (development)

| Symptom | Fix |
| --- | --- |
| Writes fail with a CSRF error after a password login | Fixed by design — the REST client sends `credentials: 'omit'`. Requires React Native ≥ 0.86 (the app is on 0.86). |
| A read-only caregiver is logged out on the first write | Not a bug in current versions — a 403 (permission denied) is kept separate from a 401 (expired session) and surfaced inline. Ensure the account has the needed Baby Buddy model permissions. |
| Entries near "now" rejected by the server | The app tracks the server clock offset and stamps entries with server time; make sure the server clock is sane. |
| `[Worklets] Mismatch…` on start | Clear the Metro cache: `npx expo start -c`. Keep `react-native-worklets` pinned (install via `npx expo install`). |
| Web preview shows no data | Web only works with `USE_MOCK_DATA`; CORS blocks real servers. |

## License

GNU GPL v3.0 — see [`../LICENSE`](../LICENSE).
