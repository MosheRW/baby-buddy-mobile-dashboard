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
- **Phase 2 done:** React Navigation native stack in `src/navigation/`, conditional auth stack. Screens under `src/features/{auth,dashboard,logEntry,settings,deleteSheet}`. Internal domain types in `src/api/types.ts`; mock data behind the `DataSource` seam (`src/data/`) that Phase 5's real API implements.
- **Phase 3 done:** Pure logic extracted + unit-tested (36 tests) in `src/lib/` — `medication.ts` (needed ±24h/overdue, eligible 10-day/now, 20-entry name-deduped suggestions), `feed.ts` (filter + day-group + food total), `timers.ts` (keys/elapsed), `dates.ts`. Persisted Zustand stores in `src/stores/` — `authStore` (secure-store, replaced the Phase 2 AuthContext), `settingsStore` (foodWindowHours + per-child ml, AsyncStorage), `timerStore` (running timers, AsyncStorage), `formStore` (draft — expanded in Phase 4). `secureStorage` falls back to AsyncStorage on web (secure-store is native-only). Tick hooks in `src/hooks/useTick.ts`: `useMinuteTick` (relative-time labels), `useTimerTick` (1s, only while ≥1 timer runs). Dashboard wired to stores + a running-timer `TimerStrip` + disabled/live-elapsed quick actions. LogEntry has a minimal Start/Stop timer control (full timer UX is Phase 4). Verified end-to-end on web incl. persistence across reload.
- **Phase 4 done:** the full Log Entry form. Draft shape, per-type field-visibility rules, and draft⇄entry conversion are pure in `src/lib/formDraft.ts` (25 tests; 61 total). `FormDraft` is one flat record, not a per-type union, so switching the Type chip mid-edit preserves the other types' fields — `draftToEntry` reads only the saved type's. Field groups in `src/features/logEntry/fields/` (Diaper independent Pee/Poo + poo swatches, Feeding kind→method dependency with conditional amount/duration, Medication suggestions/dose/repeat+custom, Temperature, TummyTime, Sleep) plus shared `TimerControl` and `DateTimeField`. `LogEntryScreen` is wiring over `formStore`; create/edit/delete run against `dataSource`, which now has `subscribe()` so the dashboard refetches after a mutation (React Query replaces this in Phase 5). Saving a timer-backed type stops its timer. Verified on web: kind→method collapse + auto-correct, amount↔duration swap, ml→g unit, suggestion prefill, PRN label swap + custom repeat, save/edit/delete round-trips, sleep timer→entry and the "Still sleeping" toggle.
- **Phase 5 built, NOT verified against a live server.** Real Baby Buddy client in `src/api/`: `client.ts` (fetch wrapper — URL joining, `Authorization: Token …`, timeout, typed `ApiError`/`AuthError`/`NetworkError`/`ParseError`), `schemas.ts` (zod, transcribed from the server's own `openapi-schema.yml`), `normalize.ts` (pure both-ways mapping, 32 tests), `babybuddy.ts` (the `DataSource` — fans out across the 7 per-type endpoints and merges; one failing endpoint degrades instead of blanking the feed), `auth.ts`. Server state moved to TanStack Query (`src/data/queries.ts` + `queryClient.ts`); `useData.ts` is gone and `dataSource.subscribe` was replaced by cache invalidation. An `AuthError` anywhere signs the user out via the QueryCache handler. Dashboard has loading/error/retry + pull-to-refresh.
  - **Auth:** Baby Buddy enables only Session + Token auth (no `BasicAuthentication`, no token endpoint), so username/password can't yield a token directly. Both paths ship: password drives a login-form bootstrap (parse `csrfmiddlewaretoken` → POST `/login/` → read `api_key` from `/api/profile`), falling back to a "paste your API key" field on any failure. Only the token is kept.
  - **Server-model divergences** (all handled in `normalize.ts`, table in the plan): poo `red` dropped (server enum has 4), temperature method + medication scheduled/as-needed + entry author all round-trip as **tags**, `doseUnit` added, sleep `ongoing` = absent `end`, feeding duration = `end - start`, tummy-time note ⇄ `milestone`. Entry ids are namespaced `{type}:{serverId}` since endpoint ids collide.
  - **Verified:** endpoint paths return 403 not 404 (incl. `/api/medication/`), the real login page's CSRF token matches the parser, and the full UI + React Query save/delete/invalidate loop works in `USE_MOCK_DATA` mode. **Unverified:** every authenticated request. Flip `USE_MOCK_DATA` in `src/data/dataSource.ts` to run on fixtures (login is bypassed in that mode).
- **Next — Phase 6:** server-backed timers via `/api/timers/` (+ `/api/timers/{id}/restart/`), reconciling persisted local timers with server ones on launch. First, though, do an authenticated end-to-end run against the real server — see "Outstanding" in `docs/IMPLEMENTATION_PLAN.md`.

Reanimated 4 requires `react-native-worklets/plugin` in `babel.config.js` (already set). Its Jest mock is deliberately omitted from `jest.setup.js` until a test renders an animated component (it fails eagerly under jsdom otherwise).
