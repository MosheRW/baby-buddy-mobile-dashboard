/**
 * Sign-in. Baby Buddy's API accepts only Session and Token authentication —
 * `BasicAuthentication` is disabled and there is no token-issuing endpoint — so
 * the API key from the user's Settings page is the only credential the API
 * itself understands.
 *
 * Two ways to get one:
 *  1. `signInWithToken` — the user pastes the key. Officially supported, robust.
 *  2. `signInWithPassword` — bootstraps a normal web session against Baby
 *     Buddy's HTML login form, then reads `api_key` off `/api/profile` and
 *     keeps only that. This matches the handoff's username/password design but
 *     depends on Django's login page internals, so every failure path falls
 *     back to asking for the key directly.
 *
 * After either flow the app holds a token and never uses the cookie session.
 */
import type { LoginMode, Session } from './types';
import { profileResponseSchema, profileSchema, type ProfileDto } from './schemas';
import { AuthError, NetworkError, joinUrl, request } from './client';
import { extractCsrfToken } from './webForm';

/** Raised when the password flow can't complete and the user should paste a key. */
export class PasswordLoginUnavailable extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'PasswordLoginUnavailable';
  }
}

function displayName(profile: { username?: string; first_name?: string }): string {
  return profile.first_name?.trim() || profile.username?.trim() || 'me';
}

/**
 * Read `/api/profile` over the **session cookie** the login-form POST just
 * seated, and return the parsed profile (containing the `api_key` we keep).
 *
 * Deliberately NOT the REST `request()` helper: that unconditionally sends
 * `credentials: 'omit'` (load-bearing for the token-path CSRF fix in
 * `client.ts`), which would drop the very session cookie this bootstrap depends
 * on — leaving the read unauthenticated, so it 401s and the whole password
 * path falls back to "paste your API key." A plain cookie-carrying `fetch` (RN
 * attaches the shared jar automatically) is the session path, matching
 * `webForm.ts`. Failures degrade to `PasswordLoginUnavailable` so the caller
 * offers the API-key fallback rather than leaving the user stuck.
 */
async function readProfileOverSession(baseUrl: string): Promise<ProfileDto> {
  const url = joinUrl(baseUrl, 'api/profile');

  let body: string;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new PasswordLoginUnavailable(
        'Signed in, but the server would not return your profile over the session.',
      );
    }
    body = await res.text();
  } catch (err) {
    if (err instanceof PasswordLoginUnavailable) throw err;
    throw new NetworkError(err instanceof Error ? err.message : undefined);
  }

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    // A 200 that isn't JSON (e.g. an HTML page) means we didn't reach the API.
    throw new PasswordLoginUnavailable(
      "Signed in, but couldn't read your profile from this server.",
    );
  }

  const parsed = profileSchema.safeParse(json);
  if (!parsed.success) {
    throw new PasswordLoginUnavailable(
      "Signed in, but couldn't read your profile from this server.",
    );
  }
  return parsed.data;
}

/**
 * Validate an API key against `/api/profile` and build the session.
 * Doubles as the "is this server reachable and is this key good?" check.
 */
export async function signInWithToken(
  mode: LoginMode,
  baseUrl: string,
  token: string,
): Promise<Session> {
  const profile_ = await request(profileResponseSchema, { baseUrl, path: 'api/profile', token });
  const profile = {
    username: profile_.user?.username,
    first_name: profile_.user?.first_name,
    last_name: profile_.user?.last_name,
    api_key: profile_.api_key,
  };
  return {
    mode,
    baseUrl,
    token,
    userName: displayName(profile),
    language: profile_.language,
    isStaff: profile_.user?.is_staff,
  };
}

/**
 * Log in with username/password by driving the web login form, then keep only
 * the resulting API key.
 *
 * Relies on the platform cookie jar (React Native's fetch has one; a browser
 * will block this cross-origin, so the web QA preview must use a pasted key).
 */
export async function signInWithPassword(
  mode: LoginMode,
  baseUrl: string,
  username: string,
  password: string,
): Promise<Session> {
  const loginUrl = joinUrl(baseUrl, 'login/');

  let html: string;
  try {
    const page = await fetch(loginUrl, { headers: { Accept: 'text/html' } });
    if (!page.ok) throw new PasswordLoginUnavailable(`The login page returned ${page.status}.`);
    html = await page.text();
  } catch (err) {
    if (err instanceof PasswordLoginUnavailable) throw err;
    throw new NetworkError(err instanceof Error ? err.message : undefined);
  }

  const csrf = extractCsrfToken(html);
  if (!csrf) {
    throw new PasswordLoginUnavailable(
      "Couldn't read the login form from this server (it may be a different Baby Buddy version).",
    );
  }

  const form = new URLSearchParams({
    csrfmiddlewaretoken: csrf,
    username,
    password,
  });

  let postStatus: number;
  try {
    const res = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // Django rejects HTTPS form POSTs without a matching Referer.
        Referer: loginUrl,
        Accept: 'text/html',
      },
      body: form.toString(),
      redirect: 'follow',
    });
    postStatus = res.status;
    // A failed login re-renders the login form (200); a success redirects away
    // to a page with no such form. Detect the login form *specifically* — both a
    // username input and a password input. The old check ("has a CSRF token" AND
    // "contains the word password") also matched a *successful* landing page —
    // its logout form carries a CSRF token and its account menu says "password" —
    // so it reported every successful login as a failure. That single false
    // positive is why the password path never worked against a live server.
    const bodyText = await res.text();
    const backOnLoginForm =
      /name=["']username["']/i.test(bodyText) && /type=["']password["']/i.test(bodyText);
    if (backOnLoginForm) {
      throw new AuthError('Incorrect username or password.');
    }
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new NetworkError(err instanceof Error ? err.message : undefined);
  }

  if (postStatus >= 400) throw new AuthError('Incorrect username or password.');

  // The session cookie is now in the jar; ask the API who we are and, crucially,
  // for the API key we'll use from here on. This read must carry that cookie —
  // see readProfileOverSession for why it can't go through the REST client.
  const profile = await readProfileOverSession(baseUrl);

  if (!profile.api_key) {
    throw new PasswordLoginUnavailable(
      "This server's profile endpoint doesn't expose an API key.",
    );
  }

  return {
    mode,
    baseUrl,
    token: profile.api_key,
    // The real server nests the name under `user.*` (like the token flow);
    // fall back to the top-level fields for a flat response.
    userName: displayName({
      username: profile.user?.username ?? profile.username,
      first_name: profile.user?.first_name ?? profile.first_name,
    }),
    language: profile.language,
    isStaff: profile.user?.is_staff,
  };
}
