import { ApiError, AuthError, ForbiddenError, rawRequest } from '../client';

/**
 * A 403 must NOT be treated as an expired session. Baby Buddy answers a
 * write the caller isn't permitted to make (a caregiver without the Django
 * model permission) with 403, and the app used to conflate that with a 401 and
 * sign the user out mid-action. These tests pin the split: 401 → AuthError,
 * 403 → ForbiddenError (which is not an AuthError).
 */

type MockInit = { status: number; body?: string };

function mockFetchOnce({ status, body = '' }: MockInit) {
  const response = {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => null },
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(body ? JSON.parse(body) : null),
  };
  global.fetch = jest.fn().mockResolvedValue(response) as unknown as typeof fetch;
}

const opts = { baseUrl: 'https://bb.example.com', path: 'api/notes/1/', token: 't' };

afterEach(() => {
  jest.restoreAllMocks();
});

describe('rawRequest error classification', () => {
  it('maps 401 to AuthError (session ended)', async () => {
    mockFetchOnce({ status: 401 });
    await expect(rawRequest(opts)).rejects.toBeInstanceOf(AuthError);
  });

  it('maps 403 to ForbiddenError, NOT AuthError', async () => {
    mockFetchOnce({
      status: 403,
      body: JSON.stringify({ detail: 'You do not have permission to perform this action.' }),
    });
    const err = await rawRequest(opts).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(err).not.toBeInstanceOf(AuthError);
    expect((err as ForbiddenError).status).toBe(403);
    // Surfaces the server's own reason when it gives one.
    expect((err as ForbiddenError).message).toBe(
      'You do not have permission to perform this action.',
    );
  });

  it('falls back to a default message on a 403 with no body', async () => {
    mockFetchOnce({ status: 403 });
    const err = await rawRequest(opts).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenError);
    expect((err as ForbiddenError).message).toMatch(/permission/i);
  });

  it('maps other 4xx/5xx to a plain ApiError (not an auth failure)', async () => {
    mockFetchOnce({ status: 500 });
    const err = await rawRequest(opts).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).not.toBeInstanceOf(AuthError);
    expect(err).not.toBeInstanceOf(ForbiddenError);
  });

  it('returns null on 204 No Content (a successful delete)', async () => {
    mockFetchOnce({ status: 204 });
    await expect(rawRequest({ ...opts, method: 'DELETE' })).resolves.toBeNull();
  });
});
