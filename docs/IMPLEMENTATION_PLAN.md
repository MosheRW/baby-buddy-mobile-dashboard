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

### Phase 4 — Log Entry form, all 7 types ✅ done
- Typed `formDraft` + per-type field groups with the exact conditional rules:
  - Diaper: independent Pee/Poo toggles + poo color swatches.
  - Feeding: type→method dependency, timer (create mode, one per child), duration stepper only for direct-breast w/o timer, amount stepper for bottle/solid, default ml from settings.
  - Medication: recent-suggestions prefill, scheduled/PRN toggle, decimal dose stepper, repeat chips + custom hours (0.5 step), dynamic label wording.
  - Temperature: ±0.1 stepper + method segmented. Tummy time: timer/duration. Sleep: timer in create; "Still sleeping" switch + wake-time in edit. Note: common fields only.
  - Common: datetime picker, note textarea, tags (auto "by {creator}"), edit-mode Delete → confirm sheet.
- Create + edit + delete against mock store; timer chips on Dashboard jump into the right form.
- **Done when:** clicking through the interactive prototype and the app side-by-side shows identical conditional behavior.
- **Shipped as:** one flat `FormDraft` record rather than a per-type union — switching the Type chip mid-edit then has to preserve the other types' fields (the prototype does), which a union would discard. `draftToEntry` reads only the saved type's fields, so the extra fields never reach the server.
- Field-visibility rules and draft⇄entry conversion are pure in `src/lib/formDraft.ts` (25 unit tests); the screen and field groups are wiring only.
- `dataSource` gained a `subscribe()` change notification so the dashboard refetches after a save/delete. Phase 5 replaces it with React Query cache invalidation.
- `@react-native-community/datetimepicker` has no web implementation, so `DateTimeField` uses the Android picker on-target and degrades to a `YYYY-MM-DD HH:mm` text field in the web QA preview.

### Phase 5 — API integration ✅ done, verified against a live server
- Fetch wrapper with timeout + zod parsing; two auth flows:
  - **Direct Baby Buddy:** POST credentials → obtain API token (or use `/api/profile` with token), store in secure store, `Authorization: Token …` thereafter.
  - **Home Assistant add-on:** base URL + long-lived access token via the add-on's ingress path — verify the exact ingress route against a real HA instance early, this is the riskiest unknown in the plan.
- Endpoints: `GET /api/children/`, per-type entry list endpoints (`changes`, `feedings`, `notes`, `sleep`, `temperature`, `tummy-times`, and medication via notes/tags or the meds endpoint depending on server version — confirm against target Baby Buddy version), POST/PATCH/DELETE per type.
- `normalize.ts` maps every response into the internal `Entry` union; React Query hooks (`useChildren`, `useEntries(childId)`, mutations with optimistic updates) replace the mock provider.
- Loading skeletons on dashboard/feed, error banner + retry, auth-failure handling → logout.
- **Done when:** app runs against a real Baby Buddy instance end-to-end (both auth modes). **Not yet met** — no authenticated run has happened (see "Outstanding" below).

#### What the real schema changed (verified against the server's own `openapi-schema.yml`)

Open questions 2 and 3 are now answered:
- **HA add-on route:** the add-on is served at `<ha-host>:8123/<addon-slug>` and is plain Baby Buddy underneath, so both login modes are the same transport — a base URL plus a Baby Buddy API key. The HA *long-lived token* is not involved.
- **Medication:** `/api/medication/` exists (confirmed live, returns 403 not 404), so no notes/tags workaround is needed for the entries themselves.

Model divergences and how they're handled — all in `api/normalize.ts`:

| Design / internal | Server reality | Resolution |
|---|---|---|
| 5 poo colors incl. red | `color` enum is black/brown/green/yellow | red dropped from `PooColor` + `pooSwatch` |
| `temperature.method` | no such field | round-trips as an `oral`/`ear`/`forehead` tag |
| medication scheduled/as-needed | no such field | `as-needed` tag; absent = scheduled |
| `dose` (unitless) | `dosage` + `dosage_unit` enum | `doseUnit` in the model, default `mg`, preserved on edit; no picker |
| `sleep.ongoing` | no field (ongoing = a running Timer) | `end` omitted; a null `end` reads back as ongoing |
| feeding `durationMinutes` | derived from start/end | sent as `end = start + duration` |
| tummy-time note | no `notes` field (has `milestone`) | note ⇄ `milestone` |
| author of an entry | not recorded on any entry endpoint | `by {creator}` tag, stripped from user tags on read |

**Auth:** Baby Buddy enables only Session + Token auth (`BasicAuthentication` is off) and has no token-issuing endpoint, so the handoff's username/password login can't be implemented directly. Per the product decision, both paths ship: the password fields drive a login-form bootstrap (parse `csrfmiddlewaretoken` → POST `/login/` → read `api_key` off `/api/profile`) and every failure falls back to a "paste your API key" field. Only the token is kept; the cookie session is never reused.

#### Authenticated run — done, and what it found

`npm run test:live` (see `src/api/__tests__/live.integration.test.ts`, config `jest.integration.config.js`)
runs the real client/schemas/normalizers against a live server. Credentials come from
gitignored `.env.local`; the suite is excluded from `npm test` and skips cleanly without them.
**All 8 tests pass**, covering auth, children, the merged timeline, and create/read/edit/delete
round-trips for note, diaper, medication, temperature and feeding.

Answered:
- `/api/profile` **does** expose `api_key` → the username/password bootstrap has a key to read.
- Entry-id namespacing survives real edit and delete.
- Timeline on the test server: 100 feedings (= `PER_TYPE_LIMIT`, so capped), 65 notes, 4 sleeps, 2 medications.

Three real bugs the run exposed, all fixed:

1. **Clock skew broke every "now" entry.** Baby Buddy's `validate_time()` rejects any time
   greater than the *server's* clock. The test server trails this machine by ~1.3s, so entries
   stamped with the device's `Date.now()` were refused with "Date/time can not be in the future."
   `client.ts` now tracks the offset from each response's `Date` header and exposes `serverNow()`
   (with a 2s safety margin, since HTTP dates are second-granular); the form default and timer
   stop both use it. Only `Note` escaped this — it is the one model with no `clean()`.
2. **Duration entries sent an end time in the future.** `end = start + duration` from a "now"
   start is by definition ahead of the server; Sleep and TummyTime validate `end` as well as
   `start`. `resolveWindow()` now slides the window back to end at `now`, preserving the
   duration the user entered — which also matches what "a 20-minute feed, logged just after"
   actually means.
3. **A failed secure-store read could hang the app on a blank screen.** `App` gates its entire
   render on `hydrated`, which was only set on the success path. `onRehydrateStorage` now sets it
   on both, `secureStorage` swallows read/write failures (degrading to "no saved session"), and
   `App` has a 5s boot timeout as a hard backstop.

Also learned: `validate_unique_period` rejects overlapping entries of the same type for one child,
so a save can legitimately fail for reasons the UI doesn't predict — the error banner surfaces the
server's message verbatim, which is what makes that tolerable.

**Still outstanding:**
1. **Web is a dead end for the real API.** Baby Buddy sends no `Access-Control-Allow-Origin`, so a
   browser blocks every response — the web preview only works with `USE_MOCK_DATA`. Use Expo Go or
   a device build against a live server. (Confirmed by preflight: 200 with no CORS headers.)
2. The HA ingress path still hasn't been exercised with a token — same code path as direct, but
   unproven; ingress may additionally require a Home Assistant session.
3. The password/CSRF login bootstrap has not been run end-to-end (the live suite authenticates with
   a token). The parser matches the real login page, and `api_key` is present, but the POST hasn't
   been executed.

### Phase 6 — Server-backed timers ✅ done, verified against a live server

Start/stop go through `/api/timers/`, `timerStore` carries `serverTimerId`, and the server's running
timers are reconciled into the store on launch and on every poll.

**What the server actually does** (probed before writing anything — the spec was misleading):

| Assumption going in | Reality |
| --- | --- |
| `/api/timers/{id}/restart/` exists | **405 on this server**, GET and POST alike. Not used. |
| A timer has an `active`/`end` flag | It does not. The model is `{id, child, name, start, duration, user}` — a timer exists iff it is running, so **stopping means DELETE**. |
| Timers carry a type | They don't. `name` is the only discriminator, so we write `Feeding` / `Sleep` / `Tummy Time` — readable in the Baby Buddy web UI *and* parseable on the way back. |
| Posting an entry with `timer: id` lets the server compute the window | It does, and it consumes (deletes) the timer — **but it ignores an explicit `end`**, forcing end = now. |
| One timer per child | The server allows several. The one-per-(type, child) rule is ours to enforce. |

**Consequence for saving:** entries are *not* created via the `timer:` reference. The user can edit
the end time in the form, and the timer path would silently discard that edit. So saving keeps the
Phase 5 explicit `start`/`end` path (already live-verified, `resolveWindow` + `serverNow`) and simply
deletes the server timer afterwards. Server timers are the durable record of a *running* timer, not
the entry-creation mechanism — a much smaller blast radius on proven code.

**Degradation is the design.** The local store drives the UI; the server makes timers durable and
shared. Start and stop write the store first and call the API after, so a timer never waits on the
network. A failed create leaves a local-only timer that still runs, still shows, and still produces
an entry — it just isn't visible in the web UI. `reconcileTimers` (pure, in `src/lib/timers.ts`)
encodes the whole merge in one rule: **a local timer is discarded only when it claims a server id the
server no longer lists.** That drops timers stopped elsewhere while preserving offline ones.

Two details worth keeping:
- A stop that is slower than the next 60s poll would re-adopt the timer the caregiver just stopped,
  making it pop back onto the dashboard. `timerStore.stopping` holds those ids until the delete
  settles; reconciliation skips them. It is deliberately not persisted — an in-flight request doesn't
  survive an app kill, and the server is then the honest answer.
- Timers whose name we don't recognise, or that have no child, are **ignored, not adopted**. The live
  server already has one (`Feeding-BBapp:1`, from another client), and attaching a stranger's timer
  to our entry would be worse than not seeing it.

**Verified live** (`npm run test:live`, 11/11): start → list → stop round-trip, reconciliation of a
server timer into an empty store, reconciliation dropping a locally-claimed timer after it was
stopped server-side, and an unclassifiable timer being skipped.

### Phase 7 — Polish & release
- Empty states, keyboard handling pass, hardware-back audit, a11y pass, performance check on the 1s tick (only timer-visible components re-render).
- Icon decision closed out with design owner; final visual QA vs screenshots on a physical device.
- EAS build profile, versioning, signed AAB.

## 5. Open questions (need answers before/during the relevant phase)

1. **Icons** (Phase 1): keep custom-drawn geometric glyphs, or an icon library? Handoff says ask the design owner.
2. ~~**HA add-on API route**~~ — answered: the add-on sits at `<ha-host>:8123/<addon-slug>` and is plain Baby Buddy underneath, so it takes the same `Authorization: Token ...` header as a direct server. Still needs one authenticated run to confirm ingress does not additionally require a Home Assistant session.
3. ~~**Target Baby Buddy server version**~~ — answered: the target server exposes `/api/medication/`, so medications use the dedicated endpoint. Only the scheduled/as-needed flag rides on a tag.
4. **Android package id / app name** (Phase 0): "TBD by dev" in the handoff.
