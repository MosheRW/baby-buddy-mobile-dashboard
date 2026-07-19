# Baby Buddy Dashboard — React Native (Android)

A mobile dashboard client for a self-hosted [Baby Buddy](https://github.com/babybuddy/babybuddy) server (direct or via the Home Assistant add-on). Caregivers log diapers, feedings, medications, temperature, tummy time, and sleep for one or more children, see time-since-last stats and medication due/eligible windows, and run background timers.

**Design source of truth:** `design_handoff_react_native_app/README.md` (high-fidelity — colors, spacing, radii, copy, and interaction flows are final). The interactive prototype `Baby Buddy Dashboard App.dc.html` is the behavioral reference; open it in a browser to verify conditional logic. Screenshots in `design_handoff_react_native_app/screenshots/`.

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
- Quick visual QA without an emulator: `npx expo export --platform web --output-dir <dir>` then serve it, or `npx expo start --web`. `react-dom`/`react-native-web` are installed for this preview path only (target stays Android). On web, Reanimated's animation loop can make browser screenshots time out — verify via DOM text if so.

## Status

- **Phase 0 done:** Expo SDK 57 + TS strict, Nunito via expo-font, ESLint/Prettier/Jest configured, `src/theme/tokens.ts` built from the handoff.
- **Phase 1 done:** design-system primitives in `src/components/` (AppText, Card, StatTile, FieldLabel, TextField, ActionButton, Chip/ChipRow, SegmentedToggle, Stepper, ToggleSwitch, TagRow, SVG glyphs). `src/screens/GalleryScreen.tsx` remains as a visual-QA surface (no longer the app root).
- **Phase 2 done:** React Navigation native stack in `src/navigation/`, conditional auth stack (`src/app/AuthContext.tsx` — migrates to a persisted Zustand store in Phase 3). Screens under `src/features/{auth,dashboard,logEntry,settings,deleteSheet}`. Internal domain types in `src/api/types.ts`; mock data behind the `DataSource` seam (`src/data/`) that Phase 5's real API implements. Dashboard derivations in `src/features/dashboard/selectors.ts` and display helpers in `src/lib/entryDisplay.ts` (medication needed/eligible math is Phase-2-adequate; exact spec + tests come in Phase 3). Verified end-to-end: Login→Dashboard→LogEntry/Settings/DeleteConfirm all render and navigate.
- **Next — Phase 3:** move state to Zustand stores (auth/settings/timers/form), extract + unit-test the pure logic (`lib/medication.ts`, `lib/feed.ts`, `lib/timers.ts`, `lib/dates.ts`), wire the 60s/1s ticks. See `docs/IMPLEMENTATION_PLAN.md`.

Reanimated 4 requires `react-native-worklets/plugin` in `babel.config.js` (already set). Its Jest mock is deliberately omitted from `jest.setup.js` until a test renders an animated component (it fails eagerly under jsdom otherwise).
