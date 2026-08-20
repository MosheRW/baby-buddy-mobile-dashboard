# Share Instance — Implementation Plan (Issue #34)

QR-based caregiver onboarding: an admin creates/manages users in-app and generates a
per-user "join" QR; a new caregiver scans it on the login screen and lands on the
dashboard signed in as that user.

## The key research finding (read this first)

Baby Buddy **never exposes a user's API key on any surface except that user's own
session** — this is true of *both* the REST API and the web UI:

- `/api/profile` returns `api_key` only for the **currently authenticated** user
  (`api/serializers.py` → `ProfileSerializer`).
- The web UI only ever *regenerates the requester's own* key:
  `handle_api_regenerate_request()` calls `request.user.settings.api_key(reset=True)`.
  `users/<pk>/edit/` (`UserUpdate`) edits name/email/flags but shows **no** key.
  `user/add-device/` (`UserAddDevice`) builds a QR of the **current** user's session
  cookies, again `request.user` only.

So through the *profile / user-management* surfaces, "admin picks user X and reads X's
token" is impossible — no such page exists there.

> **Superseded during implementation.** There **is** one more surface: the Django
> **admin** authtoken page, `/admin/authtoken/tokenproxy/`, lists every DRF token —
> and Baby Buddy's `api_key` *is* a DRF authtoken `Token`. So a **superuser** admin can
> read any existing user's token by scraping that page (`listUserTokens`,
> `src/api/adminWeb.ts`). This is what the shipped code does, and it widens the scope
> boundary below: for a superuser, existing users become shareable via a token QR too,
> not only users we created this session. It stays gated on admin access and degrades
> silently (no token QR offered) when that page isn't reachable.

### How we get a token anyway: create the user, then log in as them

The web user-add form (`users/add/`, `UserAddForm`) lets an admin set the new user's
**password**. Because *we* choose that password, we can immediately authenticate **as
the new user** using the app's existing HTML+CSRF login bootstrap
(`signInWithPassword`, `src/api/auth.ts`) and read **their own** `/api/profile.api_key`.

```
Admin session ──POST /users/add/ (username, password WE set, is_staff=false)──▶ user created
        │
        └─ fresh login AS new user (username + that password) ──▶ their /api/profile ──▶ api_key
                                                                          │
                                                          QR { serverUrl, token } ──▶ scan ──▶ signed in
```

This closes the loop with **no page that reveals an existing user's key**. It also
defines the honest scope boundary below.

## Decisions (locked)

- **QR payload carries credentials, two shapes:** `{ v, url, username, password }`
  **or** `{ v, url, token }`. The password shape means the *scanning* device runs the
  existing `signInWithPassword` itself — so we don't mint a token at generation time and
  never hit the admin/new-user cookie-jar collision. The token shape reuses
  `signInWithToken`. Scanner branches on which fields are present.
- **New caregiver = read+write:** `is_staff=false`, `is_read_only=false`.
  - **Correction found while wiring the write-permission fix (issue #34 follow-up).**
    Baby Buddy's user form is **binary**, not tiered: `BabyBuddyUserForm.save()`
    (babybuddy/forms.py) sets `user.is_superuser = True` for *every* non-read-only
    account, and `is_superuser = False` + `read_only` group membership when read-only is
    checked. Its API permission class (`api/permissions.BabyBuddyDjangoModelPermissions`)
    then requires per-model `view/add/change/delete` for each method — which a superuser
    bypasses entirely and a read-only user (view-only group) fails on writes. **Net:** a
    caregiver who can write at all *is* a Django superuser. Omitting `is_read_only` (what
    `buildCreateUserForm` does) already grants full read/write/delete — no extra group or
    permission step is needed. There is **no** "read+write but not admin" server tier.
    `is_staff` only toggles Django admin-site access on top and stays opt-in.
- **"Edit only their own entries" is client-side only — now implemented.** Because a
  writing caregiver is a superuser, the server can't restrict per-entry ownership: any
  writer can edit any entry, and all caregivers share the same children/data. So we
  enforce it in *our* UI via the pure `canModifyEntry` (src/lib/entryOwnership.ts): the
  feed hides edit/delete (and makes the row non-tappable) on entries whose `by {creator}`
  author tag isn't the current user's, and the log-entry screen refuses to save/delete
  them as a backstop. **Staff** accounts (the manager) may modify anyone's entry. Any
  other Baby Buddy client bypasses this — it's a UI guard, not server enforcement.

## Scope boundary (what "share" can and cannot do)

- ✅ **Share a user we created** — we know the password, so we can mint their key. This
  is the primary flow.
- ✅ **Share the admin's own account** — trivial, it's the current session's key.
- ⚠️ **Share an arbitrary pre-existing user** (created in Baby Buddy elsewhere) —
  possible **only for a superuser**, via the admin authtoken page above
  (`listUserTokens` populates a token for the row). Without that access we don't know
  their password and no other page reveals their key, so "generate QR" is offered for a
  pre-existing user **only** when its token was readable; otherwise the row shows but
  can't be shared. `canShowQr` encodes exactly this. Surface it clearly rather than
  failing at QR time.

## Confirmed Baby Buddy web surface (from source, master branch)

| Purpose            | Route                 | View / form                    | Gate |
| ------------------ | --------------------- | ------------------------------ | ---- |
| Login (bootstrap)  | `POST /login/`        | Django `LoginView` + CSRF      | —    |
| User list          | `GET /users/`         | `UserList` (`StaffOnlyMixin`)  | staff |
| Create user        | `POST /users/add/`    | `UserAdd` + `UserAddForm`      | staff + `admin.add_user` |
| Edit user          | `POST /users/<pk>/edit/` | `UserUpdate`                | staff + `admin.change_user` |
| Delete user        | `POST /users/<pk>/delete/` | `UserDelete`              | staff |
| Own profile / key  | `GET /api/profile`    | `ProfileSerializer`            | any authed |

**`UserAddForm` fields:** `username, first_name, last_name, email, is_staff,
is_read_only, is_active` + `password1, password2` (from `UserCreationForm`). For a
non-admin caregiver: `is_staff=false`, `is_active=true`, `is_read_only` per choice.

**Admin gate:** `/api/profile` → `user.is_staff` (confirmed present). Fallback probe:
a `GET /users/` that returns the list vs. redirects/403 tells us staff-ness too.

## Reuse from the existing codebase

- **`src/api/auth.ts`** already does HTML+CSRF form login and reads `/api/profile`.
  `extractCsrfToken()` + the `/login/` POST pattern generalize to the `/users/add/`
  POST. Factor a small shared `fetchCsrf(url)` + `postForm(url, fields)` helper.
- **`signInWithPassword`** is exactly the "log in as the new user to get their key" step
  — call it (or its internals) with the generated credentials, keep only the token.
- **`profileSchema`** (`src/api/schemas.ts`) must gain `user.is_staff` for the gate.
- Cookie jar: RN `fetch` shares one jar, so the admin session and a subsequent
  new-user login **collide**. The new-user login must be isolated (dedicated fetch /
  cleared cookies) so it doesn't clobber the admin's session — verify on device.

## Work breakdown

### Batch A — web-admin client (pure-ish, testable) — DONE
- `src/api/webForm.ts` (new): shared HTML-form helpers extracted from `auth.ts` —
  `extractCsrfToken`, `getHtml`, `postForm`, `looksLikeLoginPage`, `parseFormError`,
  `decodeEntities`, `WebFormError`. `auth.ts` now imports `extractCsrfToken` from here.
- `src/api/adminWeb.ts` (new): `listUsers(session)`, `createUser(session, {username,
  password, firstName})`, pure `parseUserList` (against the real `user_list.html`
  structure: username in `<th scope="row">`, pk from `/users/<pk>/edit/` links) +
  `buildCreateUserForm` (non-admin read+write: `is_staff`/`is_read_only` omitted,
  `is_active=on`). Typed errors `NotAdminError` / `AdminWebError`.
- `Session.isStaff` added (`src/api/types.ts`); set from `/api/profile` `user.is_staff`
  in **both** sign-in flows; `profileSchema` gained an optional nested `user.is_staff`.
- Tests: `src/api/__tests__/adminWeb.test.ts` — 14 tests over the pure parsers/builders.
  Full suite green (437), typecheck clean (the 2 `expo-background-task` errors are
  pre-existing/unrelated), lint clean.
- **`mintTokenForCredentials` intentionally dropped:** decision #1 puts username+password
  in the QR, so the scanning device logs in itself — no generation-time minting, no
  admin/new-user cookie-jar collision.
- **Unverified without a live server:** the network wrappers and the session-cookie
  requirement (web pages need an admin *session*, not a token, so the manage UI must
  re-establish one via `signInWithPassword` — a Batch C concern).

### Batch B — QR payload + libraries — DONE
- `src/lib/joinCode.ts` (new): versioned JSON payload, two shapes —
  `{ v:1, url, username, password }` (scanner runs `signInWithPassword`) and
  `{ v:1, url, token }` (scanner runs `signInWithToken`). `encodeJoin`/`parseJoin`
  normalize the URL (`normalizeBaseUrl`) and reject garbage, wrong version, and
  incomplete payloads; the token shape wins if both are present.
- Tests: `src/lib/__tests__/joinCode.test.ts` — 11 tests (round-trips, URL
  normalization, all rejection paths). Full suite 448 green, typecheck + lint clean.
- Libraries: `npx expo install expo-camera@~57.0.3 react-native-qrcode-svg@^6.3.21`
  (QR generator rides the already-present `react-native-svg`). `expo-camera` config
  plugin + camera-permission string added to `app.json`.
- **Unverified without a device build:** the camera + QR rendering themselves (web QA
  can't exercise the camera); only the payload codec is tested here.

### Batch C — UI — DONE (device-verified: boot + bundle; screens pending fresh login)
- New `src/features/shareInstance/`: `ShareInstanceScreen` (unlock → share-own-login /
  add-caregiver → inline `JoinQrView`), `ScanLoginScreen` (`expo-camera` → `parseJoin` →
  sign in), `JoinQrView` (QR + security warning).
- Nav: `ShareInstance` (authed) + `ScanLogin` (unauthed) added to `types.ts` +
  `RootNavigator`. Entry points: admin-gated Settings row (`isStaff && babybuddy`);
  "Scan a sign-in QR code" button on the login screen (babybuddy mode).
- i18n: `share.*` + `login.scanQr` in en + he (parity test green).
- Verified on the OnePlus 8T: Android bundle builds (HTTP 200, 12.1 MB), app boots and
  runs with the new native deps (expo-camera, qrcode-svg) — no crash. Typecheck/lint/448
  tests green.
- **Not yet seen on-device:** the Share screen (hidden — the running session predates
  `isStaff`, so it needs a fresh login) and the scan screen (Login-stack only). Both
  require a logout→login to exercise.

### HA support (decided: try it)
- The Settings gate is now `isStaff && mode !== 'local'` (was babybuddy-only), so a
  staff session over the **Home Assistant ingress** also sees the Share row. The scan
  button shows for any non-offline mode.
- No other code changed: `adminWeb` + the unlock step already use `session.baseUrl`
  (the ingress URL for HA) and `session.mode`. So scraping targets `<ingress>/users/`
  etc. automatically.
- **Unverified risk:** the admin web pages + Baby Buddy session cookies through the HA
  ingress are untested; HA app-login uses a token, so the Share unlock asks for the BB
  username+password separately. May need iteration against a live HA server.

### Batch C — UI (original outline)
- **Admin gate**: only `session.isStaff` sees the sharing entry point (Settings →
  "Share / manage caregivers", likely under Advanced Settings).
- **User management screen**: list users; "Add caregiver" (username + generated or typed
  password, read-only toggle); per-user "Show join QR" (enabled only for shareable
  accounts per the scope boundary).
- **QR display screen**: render QR + explicit security warning (long-lived token; screen
  only; not persisted).
- **Scan-to-login**: "Scan QR" on the login screen → camera → `parseJoin` → apply
  `{url, token}` → `signInWithToken`. Camera-permission + invalid-QR states.

### Batch D — i18n, security, polish
- All new copy into `src/i18n/locales/{en,he}.ts`.
- Security review: never persist the QR token in a draft/log; warn on display.
- Empty/permission/error states; camera permission denial path.

## Risks / to confirm on a live server
- **Version drift** in `/users/` HTML and the add-form fields — wrap each parse; fail
  with a specific message, not a blank screen.
- **Cookie-jar collision** between admin session and new-user login (see above).
- **`is_read_only`** semantics — confirm a read-only caregiver can still log entries or
  not, and default accordingly.
- **HA ingress** path: the app supports Home-Assistant-fronted servers; confirm the
  scrape works behind ingress (auth/paths differ).
- No live creds in this repo (`.env.local` absent) — a device/live pass is required to
  validate every scrape and the token-minting round-trip.
