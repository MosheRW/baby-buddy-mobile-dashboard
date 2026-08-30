# Pre-Publish Audit Report — Baby Buddy (React Native / Expo, Android)

**Scope:** Mobile app source only (`src/`, `App.tsx`, `app.json`, config). Backend/API/DB and payment code out of scope (no payment code exists). Read-only pass — **no application code was changed.**

**Date:** 2026-08-30
**Commit:** `c512dc4` · version `2026.08.30-2`

---

## Executive summary

This is a **mature, unusually clean codebase**. The audit surfaced no critical vulnerabilities and no shipped secrets. The high-value items are one **likely-broken login path** (`AUTH-01`), the **absence of a root error boundary** (`BP-01`), and an **undeclared runtime dependency** (`DEP-01`). Everything else is Low-severity polish/hardening.

**What's already solid (verified, not findings):**

- Auth token is stored in **`expo-secure-store`** (Android Keystore), never plain AsyncStorage; only `authStore` holds it, partialized to the session object. (`src/stores/authStore.ts`, `src/stores/storage.ts`)
- **No hardcoded secrets, API keys, or backend URLs** in source — only example placeholders in i18n.
- **No `.env` or secrets committed.**
- **No token/PII logging** — every `console.*` is a `console.warn` of a sanitized message/error object.
- **No analytics/crash SDK** (Sentry/Firebase/etc.) → no third-party breadcrumb leakage.
- **Auth gating is correct** — protected screens are conditionally *absent* from the navigator when `session == null` (`src/navigation/RootNavigator.tsx:67`), so no deep-link / back-button bypass; App renders `null` until `hydrated` (`App.tsx:50`), so no protected screen renders before the session check.
- **401 vs 403 handled correctly** — `AuthError` (401) signs out, `ForbiddenError` (403) does not; retry excludes both (`src/data/queryClient.ts`).
- **Logout wipes all account-scoped state** and the secure token (`src/data/logout.ts`).
- **Hermes** is on (SDK 57 default; no `jsEngine` override).
- **`eslint react-hooks/exhaustive-deps` is enforced and clean** → no missing/incorrect effect deps.
- **537/537 unit tests pass**; strong design-token discipline (**zero** hardcoded hex colors in components/features).
- **Camera permission matches usage** (QR scan only) with a rationale string.
- No `any` types on auth/user data. No `TODO`/`FIXME`. No silent `catch` blocks (each degradation is documented).

Finding counts: **1 High, 4 Medium, 11 Low.** Plus 3 items in *Needs your input*.

---

## 1. Security

### SEC-01 — HTTPS not enforced; no explicit Android cleartext policy
- **Severity:** Medium
- **Location:** `src/api/client.ts:118-122` (`normalizeBaseUrl`); `app.json` (no `android.usesCleartextTraffic` / network-security config)
- **What's wrong:** `normalizeBaseUrl` only *defaults* a scheme-less host to `https://` but happily accepts a user-typed `http://` URL. The token then rides over cleartext on every request. There is no explicit network-security config in `app.json`, so cleartext behavior is left entirely to platform defaults.
- **Why it matters:** A caregiver who types `http://…` sends their `Authorization: Token …` header (a long-lived credential) in the clear, interceptable on the same network. For a self-hosted app this is a *plausible legitimate need* (LAN-only Baby Buddy over HTTP), which is exactly why it deserves a conscious decision rather than a silent default.
- **Suggested fix:** ✅ **Chosen (option b):** keep accepting `http://` (LAN self-hosting is legitimate) but show an inline warning on the Login screen when the entered server URL uses `http://`, so the cleartext risk is a conscious choice. No network-security config / HTTPS enforcement.
- **Confidence:** High (behavior is certain; the *right* policy is a judgment call).

### SEC-02 — Web fallback stores token in plaintext localStorage
- **Severity:** Low (informational)
- **Location:** `src/stores/storage.ts:24-26`
- **What's wrong:** On web, `secureStorage` falls back to AsyncStorage (localStorage), which is plaintext.
- **Why it matters:** Minimal in practice — the web target is documented as **mock-data-only** (CORS blocks a real server), so no real token is ever present on web. Worth stating explicitly so it isn't mistaken for a device-side issue.
- **Suggested fix:** None required; document that web is non-production. If a real web build is ever pursued, revisit.
- **Confidence:** High.

---

## 2. Authentication flow correctness

### AUTH-01 — Username/password login likely broken by `credentials: 'omit'`
- **Severity:** High
- **Location:** `src/api/auth.ts:136` (profile read) in combination with `src/api/client.ts:174` (`credentials: 'omit'`, unconditional in `rawRequest`)
- **What's wrong:** `signInWithPassword` seats the Django `sessionid` cookie via raw `fetch` (lines 77 & 100), then reads the API key with `request(profileSchema, { baseUrl, path: 'api/profile' })` (line 136) — **no token passed**. That call routes through `rawRequest`, which **unconditionally sets `credentials: 'omit'`**, so the just-seated session cookie is *not* sent. The profile request is therefore unauthenticated → 401/403 → caught at `auth.ts:137-143` and rethrown as `PasswordLoginUnavailable`. Net effect: the password path **always** fails and falls back to "paste your API key."
- **Why it matters:** An advertised primary sign-in method (the one the design handoff specifies) is non-functional. It fails *safe* — it degrades to the API-key/QR fallback rather than leaking anything — but a user who only knows their username/password cannot log in the intended way. This is consistent with CLAUDE.md's own note that "the password/CSRF login end-to-end" is **unproven**.
- **Suggested fix:** For the bootstrap's profile read, use a cookie-carrying fetch instead of the cookie-omitting `request()` — e.g. a dedicated raw `fetch(joinUrl(baseUrl,'api/profile'), { headers: { Accept: 'application/json' } })` (default credentials, then parse), mirroring the `webForm.ts` session-path fetches. Keep the REST client's `credentials: 'omit'` untouched (it's load-bearing for the CSRF fix).
- **Confidence:** Medium — code path is traced and the bug follows necessarily *if* RN 0.86 honors `credentials: 'omit'` (which the CSRF fix in `client.ts` already relies on). **Needs on-device/live-server verification** before fixing, since this path has no automated coverage.

---

## 3. Bad practices / robustness

### BP-01 — No error boundary at the app root
- **Severity:** Medium
- **Location:** `App.tsx` (component tree root); no `componentDidCatch` / `getDerivedStateFromError` anywhere in `src/`.
- **What's wrong:** A render-time throw in any screen propagates to the root with no boundary. In a release (Hermes, no dev redbox) this unmounts the whole tree — the user sees a blank screen or a hard crash with no recovery path.
- **Why it matters:** This is the last line of defense before publishing. A single unhandled render error (e.g. an unexpected entry shape that slips past normalization) takes down the entire app instead of one screen, with no "something went wrong / retry" affordance.
- **Suggested fix:** Add a class-component `ErrorBoundary` wrapping `RootNavigator` (inside the providers) that renders a themed fallback with a reload/retry action; optionally reset it on navigation state change.
- **Confidence:** High.

### BP-02 — Activity feed is un-virtualized
- **Severity:** Medium
- **Location:** `src/features/dashboard/ActivityFeed.tsx:116-140` (`groups.map(... group.entries.map(...))`) inside the single `ScrollView` of `src/features/dashboard/DashboardScreen.tsx:345`. Data volume set by `PER_TYPE_LIMIT = 100` × 7 types (`src/api/babybuddy.ts:42`).
- **What's wrong:** Every entry renders as its own `Card` with no `FlatList`/virtualization. A heavily-logged single child can reach a few hundred rows, all mounted at once.
- **Why it matters:** Higher memory and slower initial mount / child-switch on real-world accounts with months of history. Rows are well-memoized (`React.memo` on `FeedRow`, stable callbacks), so *re-renders* are cheap — but the full element tree is still built and held.
- **Suggested fix:** Move the feed to a `FlatList`/`SectionList` (day-grouped sections map naturally to `SectionList`) with `keyExtractor={e => e.id}`, or cap the rendered window with a "show more". If real-world entry counts are known to stay small, this can be accepted as-is.
- **Confidence:** Medium (impact scales with per-user data volume, which isn't measured here).

### BP-03 — Partial accessibility coverage; some sub-44px touch targets
- **Severity:** Low
- **Location:** Icon-only `Pressable`s across `src/features/**` and `src/components/**`; e.g. feed edit/delete buttons are 26×26 with `hitSlop={6}` (`src/features/dashboard/ActivityFeed.tsx:436-442`), back button glyph 24px + `hitSlop={8}` (`ScanLoginScreen.tsx:56-63`).
- **What's wrong:** Roughly half of interactive `Pressable`s carry an explicit `accessibilityRole`/`accessibilityLabel`; icon-only controls without a text child rely on defaults. Several touch targets land at ~38px effective (under the ~44px guideline) even after `hitSlop`.
- **Why it matters:** Screen-reader users hear unlabeled/ambiguous controls; small targets are harder to hit for motor-impaired users. Not blocking, but a pre-publish a11y pass is cheap insurance (and Play listing quality).
- **Suggested fix:** Sweep icon-only `Pressable`s for `accessibilityRole="button"` + a localized `accessibilityLabel`; bump the smallest hit areas to ≥44px effective via `hitSlop` or padding.
- **Confidence:** Medium (coverage is partial; exact per-control gaps need a focused pass).

---

## 4. Dependencies & build

### DEP-01 — `expo-constants` used directly but not a declared dependency
- **Severity:** Medium
- **Location:** Imported in `src/notifications/service.ts:24`, `src/notifications/backgroundTask.ts:19`, `src/theme/dynamicColor.tsx:26`. **Absent from `package.json` dependencies** (present only transitively, as a dep of `expo`/others in the lockfile).
- **What's wrong:** Three production files import `expo-constants` directly, but it's not declared. It resolves today only because npm hoists the transitive copy.
- **Why it matters:** Fragile — the import breaks under isolated/strict installs (pnpm, Yarn PnP) or if a future `expo` upgrade stops depending on it. This is exactly the kind of latent breakage that surfaces in a fresh CI/EAS build.
- **Suggested fix:** `npx expo install expo-constants` to add it as an explicit direct dependency at the SDK-pinned version.
- **Confidence:** High.

### DEP-02 — npm audit: 21 vulnerabilities, all in the dev/build toolchain
- **Severity:** Low
- **Location:** `npm audit` (run from installed tree): 8 high, 13 moderate — `brace-expansion`, `image-size`, `js-yaml`, `nanoid`, `postcss`, and the `metro`/`@expo/cli`/`@expo/config-*`/`expo-splash-screen`(build plugin) chains.
- **What's wrong:** Known DoS/parsing advisories in build- and lint-time packages.
- **Why it matters:** **Concrete runtime risk is low** — every affected package is a dev/build dependency (Metro bundler, ESLint, Jest, Expo CLI/prebuild plugins); **none ship in the mobile runtime bundle.** They affect the build machine, not end users. Still worth clearing before release for CI hygiene and supply-chain posture.
- **Suggested fix:** `npm audit fix` (most are non-breaking transitive bumps); re-run to confirm the remainder are build-only. Do **not** `--force` without checking Expo SDK compatibility.
- **Confidence:** High.

### DEP-03 — Installed `node_modules` is out of sync with the lockfile (blocks a green local/CI run)
- **Severity:** Low (environment state, not a repo defect)
- **Location:** `@pchmn/expo-material3-theme` is in `package.json` **and** `package-lock.json:2713` but is **not installed** in `node_modules`.
- **What's wrong:** In the current tree, `dynamicColor.test.ts` **fails to run** ("Cannot find module '@pchmn/expo-material3-theme'"), so `npm test` exits non-zero and `tsc`/`eslint` report module-resolution errors for it, `expo-camera`, `react-native-qrcode-svg`, `expo-background-task`, `expo-task-manager`. The **actual** tests are green (537/537); only the *suite load* fails.
- **Why it matters:** Any CI or teammate running against this tree without a clean install sees a red test run and a red typecheck/lint that are purely install artifacts — masking real signal.
- **Suggested fix:** `npm ci` (or `npm install`) to reconcile `node_modules` with the lockfile, then re-run `npm test` / `npm run typecheck` / `npm run lint` and confirm green.
- **Confidence:** High.

---

## 5. Unused code / assets / docs

### DEAD-01 — `GalleryScreen` is unreferenced dead source
- **Severity:** Low
- **Location:** `src/screens/GalleryScreen.tsx` — imported nowhere (Phase 1 QA surface, no longer the app root).
- **What's wrong:** Dead source file. (Metro won't bundle an unreachable module, so no runtime bloat — but it's maintenance noise and can drift.)
- **Suggested fix:** Delete it, or move to a clearly-labeled `dev/` location excluded from lint/build.
- **Confidence:** High.

### DEAD-02 — `verifySession` is an unused export
- **Severity:** Low
- **Location:** `src/api/auth.ts:163-172` — defined/exported, called nowhere.
- **What's wrong:** Dead code; also implies the intended "re-verify token on rehydrate" behavior isn't wired (the app trusts the persisted session until a request 401s).
- **Suggested fix:** Remove it, or wire it into boot if the re-verify-on-launch behavior is actually wanted (decide in *Needs your input*).
- **Confidence:** High.

### DEAD-03 — Orphaned image assets
- **Severity:** Low
- **Location:** ✅ **Verified 5 orphans:** `assets/android-icon-background.png`, `assets/android-icon-foreground.png`, `assets/android-icon-monochrome.png`, `assets/splash-icon.png`, `assets/icon.png` — zero references across `app.json` / `src` / repo (no `eas.json`, no tracked native folders). `app.json` uses `play_store_icon_512.png`, `ic_launcher_*_432.png`, `splash_1080x2340.png`, `favicon.png` (all kept).
- **What's wrong:** Leftover (probably prebuild-generated) icons not wired to any config key.
- **Why it matters:** Minor bundle bloat; ambiguity about which icon set is authoritative.
- **Suggested fix:** Delete the 5 verified orphans. **Approved.**
- **Confidence:** High (each reference checked precisely; the prior `icon.png` match was a `favicon.png` substring false positive).

### DEAD-04 — Mock data source instantiated at startup despite `USE_MOCK_DATA = false`
- **Severity:** Low
- **Location:** `src/data/dataSource.ts:20,24` — `createMockDataSource()` runs unconditionally at module load; `USE_MOCK_DATA` is `false`.
- **What's wrong:** The mock source and its fixtures are constructed and bundled even in production, where they're never used.
- **Why it matters:** Trivial startup work + a small amount of fixture code in the bundle. No security concern (fixtures are fake data).
- **Suggested fix:** Lazily construct the mock source, or guard its import behind the flag / `__DEV__`.
- **Confidence:** High.

### DOC-01 — `.gitignore` ignores `modules/` while the native module there is tracked
- **Severity:** Low
- **Location:** `.gitignore` (trailing `modules/` and `/modules`) vs. the 7 tracked files under `modules/chronometer-notification/`.
- **What's wrong:** The local Expo native module is (force-)tracked, but the ignore rule means **new files added under `modules/` won't be tracked automatically** and can be silently dropped from a commit.
- **Why it matters:** A future edit that adds a Kotlin/resource file to the native module could be omitted from the repo, producing a build that works locally but breaks on a clean EAS/CI checkout.
- **Suggested fix:** Remove the `modules/` ignore (or narrow it to a build-output subpath) so the whole native module is tracked explicitly.
- **Confidence:** High.

---

## 6. Duplicated code / logic / styles

Overall **very low duplication** — API calls, error classification, auth, and validation are centralized (`src/api/client.ts`, `src/api/auth.ts`, `src/lib/*` pure helpers with tests). Design tokens are used consistently. One drift item:

### STY-01 — Some hardcoded dimensional/spacing literals despite the "no hardcoded px" convention
- **Severity:** Low
- **Location:** ~57 raw multi-digit numeric style literals across `src/features/**` and `src/components/**`; clearest violations in `src/features/auth/LoginScreen.tsx:307-318` (`paddingTop: 44`, `paddingHorizontal: 22`, logo `width/height: 64`, `borderRadius: 20`).
- **What's wrong:** CLAUDE.md mandates all spacing/radii come from `src/theme/tokens.ts` (scale 6/8/10/12/14/16/18/20/22/26/30; radii 8–24). Some values are inlined instead — a few are true spacing values that have a token (`22 → spacing.xl`), others are small element dimensions (swatch 34×34, dot radii) that are arguably legitimate but still bypass the system.
- **Why it matters:** Minor consistency drift; makes a future spacing-scale change less mechanical. Not user-visible.
- **Suggested fix:** Replace the genuine spacing/radius literals (e.g. LoginScreen's `44`/`22`) with tokens; optionally add scale entries for recurring element sizes.
- **Confidence:** Medium (some flagged literals are legitimate element dimensions, not violations — needs a per-line judgment).

---

## Needs your input — RESOLVED

1. **Cleartext/HTTP policy (SEC-01).** ✅ **Decision: option (b) — permit `http://` but warn the user.** SEC-01's fix scope is now: keep accepting `http://` (LAN self-hosting is legitimate), but surface a warning when the user enters an `http://` server URL. No Android network-security config / HTTPS enforcement.

2. **QR join code carries plaintext credentials/token.** ✅ **Decision: accepted trade-off.** No mitigation required; not a defect. Left as-is.

3. **`verifySession` intent (DEAD-02).** ⏳ **Pending.** Function is dead code today; the app already fails safe (a revoked token signs the user out on the first fetch via `queryClient.ts`). Options: **delete** (recommended — the boot-time probe is redundant and adds a blocking cold-start request), or **wire into `RootNavigator` mount** (gated on `session`, `signOut()` on `false`) to avoid a brief dashboard→Login flash on a revoked token. Awaiting choice.

4. **Orphaned assets (DEAD-03).** ✅ **Approved + verified.** Precise reference check across `app.json`/`src`/repo (no `eas.json`, no tracked native folders) confirms **5** orphans safe to delete: `android-icon-background.png`, `android-icon-foreground.png`, `android-icon-monochrome.png`, `splash-icon.png`, `icon.png`. (The earlier `icon.png` "reference" was a false positive — a substring of `favicon.png`.) Keep: `favicon.png`, `play_store_icon_512.png`, `ic_launcher_{foreground,background}_432.png`, `splash_1080x2340.png`.

---

## Phase 2 readiness

When you're ready, reply with the finding IDs to fix and the order. Suggested priority for a publish gate:

1. **AUTH-01** (verify against a live server first — I cannot from here)
2. **BP-01** (root error boundary)
3. **DEP-01** (`expo-constants`) + **DEP-03** (`npm ci`) — cheap, unblock a clean build/CI
4. **SEC-01** — pending your policy decision in *Needs your input* #1
5. Remaining Low items (DEAD-*, STY-01, BP-02/BP-03) as time allows

I'll do one commit per logical fix (Conventional Commits, referencing the finding ID) and pause if any fix turns out more involved than described.

---

## Phase 2 — Resolution (completed)

Every finding is resolved: fixed and committed, accepted with rationale, or handed off (environment / live verification I can't perform here). One commit per logical fix, Conventional Commits, each body referencing its finding ID.

### Fixed & committed

| Finding | Commit | Summary |
|---|---|---|
| DEAD-02 | `740c1cd` | Removed unused `verifySession` + dead `rawRequest` import. |
| SEC-01 | `f10afe8` | Inline cleartext-`http://` warning at login (option b). en + he. |
| DEAD-03 | `cea4533` | Deleted 5 orphaned icon/splash assets. |
| AUTH-01 | `b1e39dc` | Read `/api/profile` over the session cookie (not the cookie-omitting REST client) so password login works. +5 tests. **⚠ unverified vs a live server.** |
| BP-01 | `d39067d` | Root `ErrorBoundary` around the navigator + themed fallback. +3 tests. |
| DEP-01 | `5d10b34` | Declared `expo-constants` as a direct dependency (`~57.0.6`). |
| DEAD-01 | `b455d1e` | Removed unreferenced `GalleryScreen`. |
| DEAD-04 | `5a7b0a7` | Lazy data-source construction (mock no longer built in production). |
| DOC-01 | `45e4c7b` | Narrowed `.gitignore` `modules/` → `modules/**/build/` so native-module source stays tracked. |
| STY-01 | `bfc75ab` | Tokenized LoginScreen's genuine spacing/radius literals (off-scale/element dims left, documented). |
| BP-02 | `6bb282c` | Virtualized the feed via a `SectionList` (dashboard content becomes the list header). **On-device QA needed.** |
| BP-03 | `b82a7b8` | Localized the settings-cog label; enlarged sub-44px touch targets (feed buttons, cog, 7 back buttons). |

### Accepted (no code change is the correct outcome)

- **SEC-02** — web stores the token in plaintext localStorage, but web is mock-data-only/non-production (CORS blocks a real server). No real token exists there.
- **DEP-02** — confirmed empirically that no safe fix exists: `npm audit fix` (non-force) does not touch the vulns, and `--force` would downgrade **Expo 57 → 46** (breaking). All 21 advisories are in build/dev tooling (Metro, ESLint, Jest, Expo CLI/prebuild) and do not ship in the runtime bundle. Revisit when upstream Expo/Metro bump their transitives.

### Handed off (cannot be done from this worktree)

- **DEP-03** — run `npm ci` in the main checkout to sync `node_modules` with the lockfile (also picks up the new `expo-constants` declaration). Clears the `dynamicColor.test.ts` suite-load failure and the `ScanLoginScreen`/`expo-camera` tsc/lint errors, which are install artifacts, not repo defects.
- **AUTH-01 verification** — sign in with username/password against a real Baby Buddy server (this path has no automated coverage here).
- **BP-02 verification** — on-device pass of the new `SectionList` dashboard: scroll, pull-to-refresh, day-group spacing, scroll-to-dismiss.

**Test status:** 545/545 unit tests pass. The single failing *suite* (`dynamicColor.test.ts`) is the DEP-03 install artifact and clears after `npm ci`.
