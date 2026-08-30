# Baby Buddy — Mobile Dashboard

A warm, fast Android dashboard for [Baby Buddy](https://github.com/babybuddy/babybuddy), the self‑hosted baby‑tracking server. Caregivers log diapers, feedings, medications, temperature, tummy time, and sleep for one or more children; see time‑since‑last stats, medication due/eligible windows, and food trends at a glance; and run background timers that survive app restarts. It also runs fully **offline** with no server at all.

Built with Expo + React Native. Android is the primary target (iOS and a web preview build exist for development).

> **Not affiliated with the Baby Buddy project.** This is an independent third‑party client for a Baby Buddy server. See [License](#license).

---

## Table of contents

- [Install (Android APK)](#install-android-apk)
- [Highlights](#highlights)
- [Screens at a glance](#screens-at-a-glance)
- [Connection modes](#connection-modes)
- [User manual](#user-manual) · full step‑by‑step guide in [`docs/USER_MANUAL.md`](docs/USER_MANUAL.md)
- [Requirements](#requirements)
- [Getting started (development)](#getting-started-development)
- [Building a release](#building-a-release)
- [Configuration & data storage](#configuration--data-storage)
- [Project layout](#project-layout)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Install (Android APK)

Prebuilt APKs are published on the **[GitHub Releases](https://github.com/MosheRW/baby-buddy-native/releases)** page.

1. Open **[github.com/MosheRW/baby-buddy-native/releases](https://github.com/MosheRW/baby-buddy-native/releases)** on your Android phone.
2. Under the latest release's **Assets**, download the `.apk` file.
3. Open the downloaded file. Android will ask you to allow installing apps from this source — approve it (**Settings → Install unknown apps** for your browser), then tap **Install**.
4. Launch **Baby Buddy** and [sign in](docs/USER_MANUAL.md#2-signing-in).

To update, download the APK from a newer release and install it over the top — your data and sign‑in are preserved.

> These are the full native builds, so notifications, the live timer notification, and background refresh all work (unlike the Expo Go preview). The APK is unsigned by Google Play, which is why Android shows the "unknown source" prompt.

---

## Highlights

- **Everything a caregiver logs, in one place** — diaper (independent pee/poo, poo colour + consistency), feeding (breast/bottle/solid, method, amount or duration, proportional gauges against your defaults), medication (dose, unit, route, body area, scheduled vs. as‑needed, 24‑hour limits), temperature, tummy time, and sleep.
- **Live "time since last"** — every child card shows how long since the last diaper, feed, and sleep, refreshed on a one‑minute tick, plus a 24‑hour food summary and food‑trend bar.
- **Medication intelligence** — "due in", "overdue by", and "eligible again" windows computed per medication, with a tappable breakdown sheet and one‑tap "log a repeat dose".
- **Background timers** — start a feeding, sleep, or tummy‑time timer; it keeps running if you close the app, is backed by the server's own timer endpoints when online, and turns into a pre‑filled entry when you stop it.
- **Rich local notifications** — scheduled‑medication reminders, medication‑eligibility nudges, forgotten‑timer alerts, diaper‑interval and minimum‑feed reminders, a live ticking timer/medication countdown in the notification shade, and a weekly caregiver‑contribution summary. Every reminder is validated against the server before it fires so a stale reminder never lies. *(Notifications require a dev/EAS build — they are inert in Expo Go and on web.)*
- **Multiple children, your way** — hide children from the dashboard, group them, give each a colour accent, and set schedules that auto‑hide a child during set hours. Shake the phone (or tap a chip) to briefly reveal hidden children.
- **Made to look at** — Nunito typography, a cream/pastel palette, custom‑drawn geometric glyphs, full **light / dark / follow‑system** theming, and optional **Material You** dynamic colour from your wallpaper (Android 12+).
- **English + Hebrew** with right‑to‑left text, defaulting to your Baby Buddy profile language and overridable in Settings.
- **Works offline** — a fully local, on‑device mode with no server required.

## Screens at a glance

| Screen | What it's for |
| --- | --- |
| **Login** | Connect to a Baby Buddy server, a Home Assistant add‑on, or run offline. |
| **Dashboard** | Per‑child cards, quick‑action buttons, running‑timer strip, notification carousel, greeting. |
| **Log Entry** | The one form for every entry type; fields change with the type you pick. |
| **Settings** | Appearance, time format, language, stats, per‑child defaults, sign out. |
| → Notification Settings | Toggle and tune every reminder category. |
| → Advanced Settings | Default visibility, shake‑to‑reveal, groups, per‑child editors. |
| → Share Instance | (Staff accounts) Invite another caregiver via QR / join code. |

## Connection modes

Pick one on the login screen:

1. **Baby Buddy** — a direct URL to your self‑hosted Baby Buddy server. Sign in with your **username + password** (the app bootstraps an API key for you) or paste an **API key** directly. You can also **scan a QR** login code.
2. **Home Assistant** — the Baby Buddy Home Assistant add‑on, reached through its ingress URL with a **long‑lived access token**.
3. **Offline (Local)** — no server at all. Everything is stored on the device. Good for a single caregiver, one phone, no infrastructure. You name your first child on the way in and manage children from Settings.

See [`docs/USER_MANUAL.md`](docs/USER_MANUAL.md) for exactly what to enter in each mode.

---

## User manual

The complete, screen‑by‑screen guide — signing in, logging each entry type, timers, medication windows, notifications, multi‑child setup, theming, and troubleshooting — lives in **[`docs/USER_MANUAL.md`](docs/USER_MANUAL.md)**.

Quick version:

1. **Sign in** using one of the three modes above.
2. On the **Dashboard**, tap a **quick action** (Diaper, Food, Sleep, Tummy, Medication, More) to open a pre‑filled log form, or tap a child card for its details.
3. In the **Log Entry** form, pick the **Type** chip, fill the fields that appear, adjust the **date/time**, and **Save**. For sleep/feeding/tummy time you can instead **Start a timer** and stop it later.
4. Watch **time‑since‑last** stats and **medication windows** update on the dashboard. Tap a medication row to log a repeat dose or open its breakdown.
5. Open **Settings** to change appearance, language, time format, per‑child food defaults, and notification behaviour, or to sign out.

---

## Requirements

- **Node.js** 18+ and **npm**.
- **Expo** tooling (installed via `npx`, no global install needed).
- For device/emulator builds: **Android Studio** + an Android emulator, or a physical Android device with **Expo Go** (JS‑only features) or a **dev build** (native features like notifications).
- A reachable **Baby Buddy server** for the online modes — or none at all for offline mode.

## Getting started (development)

```bash
npm install
npx expo start
```

Then press **`a`** to open the Android emulator, or scan the QR code with **Expo Go** on your device.

Useful scripts:

```bash
npm start          # expo start (dev server)
npm run android    # native Android build + run (expo run:android)
npm run web        # web preview (mock data only — see below)
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Jest unit tests
npm run test:live  # integration tests against a real server (needs .env.local)
```

### Web preview caveat

`npm run web` is a QA convenience only and **only works with mock data**. Baby Buddy sends no `Access-Control-Allow-Origin` header, so a browser blocks every real API response. To exercise a real server, use Expo Go or a device build. Toggle `USE_MOCK_DATA` in [`src/data/dataSource.ts`](src/data/dataSource.ts) to run on fixtures.

### Native features need a dev build

Local notifications, the live chronometer notification, background refresh, shake‑to‑reveal on some devices, and Material You dynamic colour rely on native modules. They are **no‑ops in Expo Go and on web** and require a prebuild + dev/EAS build:

```bash
npx expo prebuild --platform android
npx expo run:android
```

After changing Reanimated/Worklets versions, start with a clean cache: `npx expo start -c`.

## Building a release

An EAS build is the supported path for a shippable APK/AAB with all native modules linked:

```bash
npx expo install -g eas-cli   # if you don't have it
eas build --platform android
```

The app id / package is `com.babybuddy.dashboard` (Android) and `com.mosherw.babybuddy` (iOS); the version is set in [`app.json`](app.json) and [`package.json`](package.json).

## Configuration & data storage

- **Tokens & credentials** — stored with `expo-secure-store` (falls back to `AsyncStorage` on web, where secure storage is unavailable). Only the API token is ever kept; passwords are used once to bootstrap a token and then discarded.
- **Preferences** (theme, language, food defaults, notification toggles, kid visibility/groups, timers, form drafts) — persisted with `AsyncStorage` via Zustand stores in [`src/stores/`](src/stores).
- **Offline data** — children, entries, and timers live entirely on the device in the local data store.
- **Server state** (children, entries, timers when online) — fetched and cached with TanStack Query; never held in app state.
- **Live‑test config** — `npm run test:live` reads a gitignored `.env.local` with `BABYBUDDY_URL` and `BABYBUDDY_TOKEN`; it skips cleanly when absent.

## Project layout

```
src/
  api/         Baby Buddy REST client, zod schemas, normalization, auth
  components/  Design‑system primitives (AppText, Card, StatTile, buttons…) + glyphs
  data/        DataSource seam, TanStack Query hooks, local (offline) store
  features/    Screens grouped by area: auth, dashboard, logEntry, settings, …
  hooks/       Ticks, timers, notifications, language, shake detection
  i18n/        i18next setup + en/he locale files
  lib/         Pure, unit‑tested logic: medication math, feed grouping, timers,
               notifications planner, contribution stats, dates, tags, visibility
  navigation/  React Navigation native stack + navigation ref
  notifications/ Native notification service, background task, rebuild
  stores/      Persisted Zustand stores (auth, settings, timers, kids, theme…)
  theme/       Design tokens, light/dark palettes, accent + dynamic colour
modules/       Local Expo native module: chronometer notification (Android/Kotlin)
docs/          Implementation plan, design‑refresh plan, USER_MANUAL.md
design_handoff_react_native_app/  Original high‑fidelity design source
```

Design source of truth: `design_handoff_react_native_app/README.md` plus `CHANGES_SINCE_LAST_HANDOFF.md`. Build plan: [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md). Architecture notes and conventions: [`CLAUDE.md`](CLAUDE.md).

## Testing

- **Unit tests** — `npm test` (Jest + React Native Testing Library). Pure logic in `src/lib` and stores are heavily covered.
- **Type & lint** — `npm run typecheck` and `npm run lint`.
- **Live integration** — `npm run test:live` runs against a real Baby Buddy server (config in `.env.local`); it is excluded from the default suite.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Writes fail with a CSRF error after a password login | Fixed by design — the REST client sends `credentials: 'omit'`. Requires React Native ≥ 0.86 (the app is on 0.86). |
| A read‑only caregiver is logged out on the first write | Not a bug in current versions — a 403 (permission denied) is kept separate from a 401 (expired session) and surfaced inline. Ensure the account has the needed Baby Buddy model permissions. |
| Entries near "now" rejected by the server | The app tracks the server clock offset and stamps entries with server time; make sure the server clock is sane. |
| `[Worklets] Mismatch…` on start | Clear the Metro cache: `npx expo start -c`. Keep `react-native-worklets` pinned (install via `npx expo install`). |
| Notifications never fire | They need a dev/EAS build; they are inert in Expo Go and on web. Also check notification permission and battery‑optimization settings. |
| Web preview shows no data | Web only works with `USE_MOCK_DATA`; CORS blocks real servers. |

---

## License

Copyright © 2026 Moshe Winberg.

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License v3.0** as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but **WITHOUT ANY WARRANTY**; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the [GNU General Public License](LICENSE) for more details.

The full license text is in [`LICENSE`](LICENSE).

Baby Buddy itself is a separate project with its own license; this app is an independent client and is not endorsed by or affiliated with it.
