import { PasswordLoginUnavailable, signInWithPassword } from '../auth';
import { AuthError } from '../client';

/**
 * The username/password path bootstraps a Django web session, then reads the
 * API key off `/api/profile`. The regression this guards (AUTH-01): that
 * profile read must carry the just-seated **session cookie**. It previously
 * went through the REST client, which sends `credentials: 'omit'` (load-bearing
 * for the token-path CSRF fix) — so the cookie was dropped, the read 401'd, and
 * the password login *always* fell back to "paste your API key." A future
 * refactor rerouting it through the cookie-omitting client would break it the
 * same way; the cookie-carrying assertion below is the trip wire.
 */

const BASE = 'https://bb.example.com';

interface MockRes {
  status: number;
  body: string;
}

function res({ status, body }: MockRes) {
  return {
    status,
    ok: status >= 200 && status < 300,
    url: '',
    headers: { get: () => null },
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(body ? JSON.parse(body) : null),
  };
}

const LOGIN_PAGE = res({
  status: 200,
  body: '<form><input name="csrfmiddlewaretoken" value="tok123"></form>',
});
// A successful POST lands somewhere with no login form (no username/password inputs).
const POST_OK = res({ status: 200, body: '<html><body>Dashboard</body></html>' });
// A failed POST re-renders the login form.
const POST_REJECTED = res({
  status: 200,
  body: '<form><input name="username"><input type="password"></form>',
});

/** Route each fetch by URL + method to a scripted response. */
function scriptFetch(profileRes: ReturnType<typeof res>, postRes = POST_OK) {
  global.fetch = jest.fn((url: string, init?: { method?: string }) => {
    const method = init?.method ?? 'GET';
    if (url.endsWith('/login/')) return Promise.resolve(method === 'POST' ? postRes : LOGIN_PAGE);
    if (url.endsWith('/api/profile')) return Promise.resolve(profileRes);
    return Promise.reject(new Error(`unexpected fetch: ${method} ${url}`));
  }) as unknown as typeof fetch;
}

function profileFetchInit(): { credentials?: string } | undefined {
  const call = (global.fetch as jest.Mock).mock.calls.find((c) =>
    String(c[0]).endsWith('/api/profile'),
  );
  return call?.[1];
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('signInWithPassword', () => {
  it('returns a session carrying the API key read off the session profile', async () => {
    scriptFetch(res({ status: 200, body: JSON.stringify({ username: 'sarah', api_key: 'KEY', language: 'en' }) }));

    const session = await signInWithPassword('babybuddy', BASE, 'sarah', 'pw');

    expect(session.token).toBe('KEY');
    expect(session.userName).toBe('sarah');
    expect(session.mode).toBe('babybuddy');
    expect(session.language).toBe('en');
  });

  it('reads the profile with the session cookie, not the cookie-omitting REST path', async () => {
    scriptFetch(res({ status: 200, body: JSON.stringify({ username: 'sarah', api_key: 'KEY' }) }));

    await signInWithPassword('babybuddy', BASE, 'sarah', 'pw');

    // The trip wire for AUTH-01: the profile read must NOT omit credentials, or
    // the session cookie is dropped and the whole path fails.
    expect(profileFetchInit()?.credentials).not.toBe('omit');
  });

  it('rejects a wrong username/password with AuthError', async () => {
    scriptFetch(res({ status: 200, body: '{}' }), POST_REJECTED);
    await expect(signInWithPassword('babybuddy', BASE, 'sarah', 'bad')).rejects.toBeInstanceOf(
      AuthError,
    );
  });

  it('falls back to PasswordLoginUnavailable when the profile read is unauthorized', async () => {
    scriptFetch(res({ status: 401, body: '' }));
    await expect(signInWithPassword('babybuddy', BASE, 'sarah', 'pw')).rejects.toBeInstanceOf(
      PasswordLoginUnavailable,
    );
  });

  it('falls back to PasswordLoginUnavailable when the profile carries no api_key', async () => {
    scriptFetch(res({ status: 200, body: JSON.stringify({ username: 'sarah' }) }));
    await expect(signInWithPassword('babybuddy', BASE, 'sarah', 'pw')).rejects.toBeInstanceOf(
      PasswordLoginUnavailable,
    );
  });
});
