# Implementation Plan — Baby Buddy Dashboard (React Native / Android)

Source design: `design_handoff_react_native_app/README.md` (authoritative for visuals + behavior).
This document covers the tech stack rationale, project structure, and a phased build plan.

---

## 1. Tech stack & packages

| Concern | Choice | Why |
|---|---|---|
| Framework | **Expo (managed), latest SDK, TypeScript strict** | Fastest path to a polished Android app; OTA-updatable; EAS handles signing/builds. Nothing in this app (fonts, SVG, secure storage, date pickers, background-ish timers) needs bare RN. |
| Navigation | **@react-navigation/native + native-stack** | 4 screens (Login, Dashboard, LogEntry, Settings) + one modal. File-based routing (Expo Router) adds ceremony for no benefit at this size. LogEntry and the delete sheet present as modals. |
| Server state | **@tanstack/react-query** | Children + entries are server data with caching, refetch-on-focus, and optimistic create/edit/delete — exactly React Query's job. Gives us loading/error states (which the prototype lacks and the handoff requires us to add) almost for free. |
| Client state | **zustand** (+ `persist` middleware) | Auth session, `foodWindowHours`, per-child default food ml, running timers, in-progress form draft. Small, no boilerplate, easy to persist selected slices to AsyncStorage. |
| Storage | **@react-native-async-storage/async-storage** (prefs) + **expo-secure-store** (tokens, HA long-lived token, credentials) | Secrets never go in AsyncStorage. |
| Date/time picker | **@react-native-community/datetimepicker** | Native Android material pickers for the "Time" and "Woke up at" fields; Expo-compatible. |
| Fonts | **expo-font + @expo-google-fonts/nunito** | Bundle Nunito 400/600/700/800 locally per the handoff (no runtime Google Fonts fetch). |
| Icons/glyphs | **react-native-svg**, custom minimal geometric glyphs | The handoff explicitly says the prototype glyphs are intentionally minimal div-drawn shapes and to **ask the design owner** before swapping in an icon library. Default: recreate them as small SVG components in `src/components/glyphs/`. ⚠️ Open question — confirm with design owner (fallback: `lucide-react-native`, thin stroke, matched sizes). |
| Bottom sheet | **Custom** (RN `Modal` + `react-native-reanimated` slide-up, `expo-blur` scrim) | One simple confirm sheet with a drag handle doesn't justify `@gorhom/bottom-sheet`'s gesture-handler setup. Reanimated is worth having anyway for the carousel and toggle-knob animation. |
| Carousel (≤2 children) | **FlatList** with `snapToInterval` + peek sliver | Card width 300 + 40px peek is a plain snap layout; no carousel library needed. |
| HTTP | **fetch** wrapper (no axios) + **zod** for response parsing | Two backends (direct Baby Buddy, HA add-on) get normalized at one boundary; zod validates/parses server responses into internal types so UI never sees raw API shapes. |
| Forms | Plain controlled state (the `formDraft` slice) | The form is one shell with heavy conditional field visibility keyed off type/method/timer state — react-hook-form fights that; a typed draft object + pure "visible fields" helpers is simpler. |
| Lint/format | eslint (`eslint-config-expo`) + prettier + `tsc --noEmit` in CI | Standard. |
| Tests | **jest + @testing-library/react-native** | Priority: unit tests for the pure logic (medication windows, feed grouping, timer elapsed, feeding-method rules); component tests for the form's conditional visibility. |
| Builds | **EAS Build** (Android APK/AAB) | Standard Expo release path. |

Deliberately **not** used: Redux (overkill), axios (fetch suffices), Expo Router, NativeWind/Tamagui (the design is a small bespoke token set — a plain `tokens.ts` + `StyleSheet` matches the handoff's precision better than a utility framework), @gorhom/bottom-sheet (one sheet).

## 2. Project structure

```
src/
  api/            # client.ts (fetch wrapper), babybuddy.ts, homeassistant.ts,
                  # normalize.ts (both backends → internal Entry), types.ts, schemas.ts (zod)
  components/     # SegmentedToggle, Chip, ChipRow, Stepper, ToggleSwitch, Card,
                  # FieldLabel, TextField, ActionButton, TagRow, glyphs/
  features/
    auth/         # LoginScreen, useAuth store slice
    dashboard/    # DashboardScreen, ChildCard, ChildCarousel, ChildTabs,
                  # TimerStrip, QuickActions, ActivityFeed
    logEntry/     # LogEntryScreen (form shell), per-type field groups
                  # (DiaperFields, FeedingFields, MedicationFields, ...)
    settings/     # SettingsScreen
    deleteSheet/  # DeleteConfirmSheet
  lib/            # medication.ts (needed/eligible math), feed.ts (filter+day grouping),
                  # timers.ts (elapsed calc), dates.ts (relative time), __tests__/
  stores/         # authStore, settingsStore, timerStore, formStore (zustand)
  theme/          # tokens.ts (colors/spacing/radii/type/shadows), typography.ts
```

## 3. Practices

1. **Tokens only.** Every color/space/radius/font-size in components references `src/theme/tokens.ts`. The handoff already provides hex conversions of the OKLCH values — verify a few against the prototype screenshots when building the theme.
2. **Normalize at the boundary.** Both auth modes produce the same internal `Session` and the same `Entry` union type (`diaper | feeding | medication | temperature | tummyTime | sleep | note`). Everything past `src/api/` is backend-agnostic.
3. **Pure logic, tested.** Medication needed/eligible windows (±24h due window, 10-day PRN lookback, overdue/now labels), suggestion dedupe (last 20 meds by name), feeding method rules per type, feed day-grouping — all pure functions with unit tests before UI wiring.
4. **Timers are global + server-backed.** `timerStore` holds `{type, childId, startedAt, serverTimerId?}`, persisted so a killed app resumes correctly. Prefer Baby Buddy's `/api/timers/` start/stop so timers survive reinstall and appear in the web UI; client-side elapsed display derives from `startedAt`, not an accumulating counter. One 1s interval runs only while ≥1 timer is active (torn down when the set empties); a separate 60s tick refreshes relative-time labels.
5. **Optimistic mutations.** POST/PATCH/DELETE update the React Query cache optimistically with rollback on error + a toast/banner (loading & error states are our responsibility — not in the prototype).
6. **Accessibility & Android basics.** `accessibilityRole`/labels on chips and steppers, ≥44px touch targets (the design's smaller visuals get hitSlop), hardware back closes form/sheet before leaving Dashboard, `KeyboardAvoidingView` on Login/form.
7. **Verification loop.** Compare each built screen against `screenshots/*.png` and the interactive prototype (open the `.dc.html` in a browser and click through the exact state machine) before calling a phase done.

## 4. Phased build plan

### Phase 0 — Bootstrap
- `npx create-expo-app` (TypeScript template), strip demo code; set Android package id (TBD by team).
- ESLint/Prettier/typecheck scripts; Jest + RNTL config; `git init` + sensible `.gitignore`.
- Load Nunito via `expo-font`/`@expo-google-fonts/nunito` with a splash-gated font wait.
- `src/theme/tokens.ts` from the handoff Design Tokens section (colors as hex, spacing/radii/type scales, shadow presets mapped to `elevation` + iOS shadow props).
- **Done when:** app boots on Android emulator showing a token-styled placeholder in Nunito.

### Phase 1 — Design-system components
Build the shared primitives against tokens, with a temporary gallery screen for visual QA:
SegmentedToggle (login mode, temp method, scheduled/as-needed) · Chip + ChipRow (type/filter/repeat chips, wrap + horizontal-scroll variants) · Stepper (configurable step/format: ±5 min, ±10 ml/g, ±0.5 dose decimal, ±0.1°) · ToggleSwitch (44×24 animated) · TextField + FieldLabel (uppercase 11/700 caption) · ActionButton (accent/danger/grey, disabled) · Card + tinted stat tile · TagRow (auto "by {name}" non-removable first chip) · glyphs (diaper, bottle, capsule, thermometer, moon, tummy, dots, chevron, X).
- **Done when:** gallery matches prototype visuals side-by-side.

### Phase 2 — Navigation + screens with mock data
- React Navigation native stack: Login → Dashboard; LogEntry + Settings; DeleteConfirmSheet as transparent modal.
- Static mock children/entries matching the prototype's demo data, behind the same interface the real API client will implement (swap point for Phase 5).
- Screens at full visual fidelity, minimal logic: Login (both modes, fake submit), Dashboard (header greeting, child card, quick actions, feed), LogEntry shell (type chips + time field + note/tags + save/delete), Settings, delete sheet (scrim + blur + slide-up).
- **Done when:** every screenshot in `screenshots/` is reproducible in the running app.

### Phase 3 — Core logic (pure functions + stores)
- `lib/medication.ts`, `lib/feed.ts`, `lib/timers.ts`, `lib/dates.ts` with unit tests (this is the phase where the handoff's medication math is implemented exactly: scheduled ±24h window + overdue; PRN 10-day lookback + "now"; 20-entry name-deduped suggestions).
- Zustand stores: `settingsStore` (foodWindowHours, per-child default ml — persisted), `timerStore` (persisted), `formStore` (draft + mode + editing id), `authStore` (session, persisted to secure store).
- Wire Dashboard to logic: needed/eligible med rows, food-total window, feed filter + day grouping, adaptive nav (carousel ≤2 / tabs ≥3), timer strip + quick-action disabled/live-elapsed states, 60s/1s ticks.
- **Done when:** unit tests green; dashboard behaves per handoff against mock data.

### Phase 4 — Log Entry form, all 7 types
- Typed `formDraft` union + per-type field groups with the exact conditional rules:
  - Diaper: independent Pee/Poo toggles + poo color swatches.
  - Feeding: type→method dependency, timer (create mode, one per child), duration stepper only for direct-breast w/o timer, amount stepper for bottle/solid, default ml from settings.
  - Medication: recent-suggestions prefill, scheduled/PRN toggle, decimal dose stepper, repeat chips + custom hours (0.5 step), dynamic label wording.
  - Temperature: ±0.1 stepper + method segmented. Tummy time: timer/duration. Sleep: timer in create; "Still sleeping" switch + wake-time in edit. Note: common fields only.
  - Common: datetime picker, note textarea, tags (auto "by {creator}"), edit-mode Delete → confirm sheet.
- Create + edit + delete against mock store; timer chips on Dashboard jump into the right form.
- **Done when:** clicking through the interactive prototype and the app side-by-side shows identical conditional behavior.

### Phase 5 — API integration
- Fetch wrapper with timeout + zod parsing; two auth flows:
  - **Direct Baby Buddy:** POST credentials → obtain API token (or use `/api/profile` with token), store in secure store, `Authorization: Token …` thereafter.
  - **Home Assistant add-on:** base URL + long-lived access token via the add-on's ingress path — verify the exact ingress route against a real HA instance early, this is the riskiest unknown in the plan.
- Endpoints: `GET /api/children/`, per-type entry list endpoints (`changes`, `feedings`, `notes`, `sleep`, `temperature`, `tummy-times`, and medication via notes/tags or the meds endpoint depending on server version — confirm against target Baby Buddy version), POST/PATCH/DELETE per type.
- `normalize.ts` maps every response into the internal `Entry` union; React Query hooks (`useChildren`, `useEntries(childId)`, mutations with optimistic updates) replace the mock provider.
- Loading skeletons on dashboard/feed, error banner + retry, auth-failure handling → logout.
- **Done when:** app runs against a real Baby Buddy instance end-to-end (both auth modes).

### Phase 6 — Server-backed timers
- Start/stop via `/api/timers/`; store `serverTimerId` in `timerStore`; on app launch reconcile local persisted timers with server-side active timers (server wins).
- Saving a feeding/sleep/tummy entry from a running timer submits with the timer reference so Baby Buddy computes duration.
- **Done when:** a timer started in the app shows in the Baby Buddy web UI and survives app kill.

### Phase 7 — Polish & release
- Empty states, keyboard handling pass, hardware-back audit, a11y pass, performance check on the 1s tick (only timer-visible components re-render).
- Icon decision closed out with design owner; final visual QA vs screenshots on a physical device.
- EAS build profile, versioning, signed AAB.

## 5. Open questions (need answers before/during the relevant phase)

1. **Icons** (Phase 1): keep custom-drawn geometric glyphs, or an icon library? Handoff says ask the design owner.
2. **HA add-on API route** (Phase 5): exact ingress/base path and auth header for the Baby Buddy add-on — needs a real HA instance to verify.
3. **Target Baby Buddy server version** (Phase 5): affects whether medications use a dedicated endpoint or the notes/tags convention.
4. **Android package id / app name** (Phase 0): "TBD by dev" in the handoff.
