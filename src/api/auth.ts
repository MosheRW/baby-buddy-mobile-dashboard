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
import { profileResponseSchema, profileSchema } from './schemas';
import { ApiError, AuthError, NetworkError, joinUrl, rawRequest, request } from './client';

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
  return { mode, baseUrl, token, userName: displayName(profile) };
}

/** Pull Django's CSRF token out of the login page's hidden input. */
function extractCsrfToken(html: string): string | null {
  const m = /name=["']csrfmiddlewaretoken["']\s+value=["']([^"']+)["']/.exec(html);
  return m ? m[1] : null;
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
    // A failed login re-renders the form (200) instead of redirecting away.
    const bodyText = await res.text();
    if (extractCsrfToken(bodyText) && /password/i.test(bodyText)) {
      throw new AuthError('Incorrect username or password.');
    }
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new NetworkError(err instanceof Error ? err.message : undefined);
  }

  if (postStatus >= 400) throw new AuthError('Incorrect username or password.');

  // The session cookie is now in the jar; ask the API who we are and, crucially,
  // for the API key we'll use from here on.
  let profile;
  try {
    profile = await request(profileSchema, { baseUrl, path: 'api/profile' });
  } catch (err) {
    if (err instanceof ApiError) {
      throw new PasswordLoginUnavailable(
        'Signed in, but the server would not return your profile over the session.',
      );
    }
    throw err;
  }

  if (!profile.api_key) {
    throw new PasswordLoginUnavailable(
      "This server's profile endpoint doesn't expose an API key.",
    );
  }

  return { mode, baseUrl, token: profile.api_key, userName: displayName(profile) };
}

/** Cheap liveness/permission probe used after rehydrating a stored session. */
export async function verifySession(session: Session): Promise<boolean> {
  try {
    await rawRequest({ baseUrl: session.baseUrl, path: 'api/profile', token: session.token });
    return true;
  } catch (err) {
    if (err instanceof AuthError) return false;
    // Network trouble isn't proof the token is bad — keep the session.
    return true;
  }
}
