/**
 * Thin fetch wrapper for the Baby Buddy REST API: URL joining, token auth,
 * timeouts, typed errors, and zod parsing of every response.
 *
 * Kept dependency-free (no axios) — the surface we need is small, and the
 * interesting behaviour is error classification, which a library wouldn't do
 * for us anyway.
 */
import type { z } from 'zod';

export const DEFAULT_TIMEOUT_MS = 15_000;

/** Any failure that reached the server and got a non-2xx back. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 401 — a bad or revoked token. Callers sign the user out on this. */
export class AuthError extends ApiError {
  constructor(message = 'Your session is no longer valid. Please log in again.') {
    super(401, message);
    this.name = 'AuthError';
  }
}

/**
 * 403 — authenticated, but not allowed to perform *this* action. On a
 * self-hosted Baby Buddy this is usually a caregiver who lacks the Django model
 * permission for writes (reads need none, so the dashboard loads fine and only
 * the first create/edit/delete fails). It is deliberately **not** an AuthError:
 * the token is valid, so the remedy is a permission grant, not a re-login, and
 * callers must not sign the user out — that would turn "you can't delete this"
 * into a baffling logout.
 */
export class ForbiddenError extends ApiError {
  constructor(message = "You don't have permission to do that on this server.") {
    super(403, message);
    this.name = 'ForbiddenError';
  }
}

/** Could not reach the server at all (offline, bad host, TLS failure). */
export class NetworkError extends Error {
  constructor(message = 'Could not reach the server. Check the URL and your connection.') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends NetworkError {
  constructor(ms: number) {
    super(`The server did not respond within ${Math.round(ms / 1000)}s.`);
    this.name = 'TimeoutError';
  }
}

/** The server returned 2xx but a shape we don't understand. */
export class ParseError extends Error {
  constructor(
    readonly path: string,
    readonly issues: unknown,
  ) {
    super(`Unexpected response shape from ${path}.`);
    this.name = 'ParseError';
  }
}

// --- Server clock -----------------------------------------------------------
// Baby Buddy rejects entry times in the future (`validate_time` compares against
// the server's own clock), so a phone running even a second ahead of the server
// cannot log a "now" entry. Every response carries a `Date` header, so we track
// the offset and stamp new entries with the server's idea of now instead.

let clockSkewMs = 0;

/**
 * HTTP `Date` is second-granular and the response spent some time in flight, so
 * the measurement is only good to about a second. `serverNow` subtracts this
 * margin to stay safely on the past side of the server's clock; a couple of
 * seconds is immaterial for logging a feed or a diaper change.
 */
const CLOCK_SAFETY_MS = 2_000;

function recordServerClock(header: string | null): void {
  if (!header) return;
  const serverMs = Date.parse(header);
  if (Number.isFinite(serverMs)) clockSkewMs = serverMs - Date.now();
}

/** Current time as the server would see it, biased slightly into the past. */
export function serverNow(): number {
  return Date.now() + clockSkewMs - CLOCK_SAFETY_MS;
}

/** Milliseconds the server's clock trails this device's (negative = behind). */
export function getClockSkewMs(): number {
  return clockSkewMs;
}

/** Test seam. */
export function __setClockSkewForTests(ms: number): void {
  clockSkewMs = ms;
}

/** Join a base URL and path without doubling or dropping slashes. */
export function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/** Normalize user-typed input into a usable base URL (default https, no trailing /). */
export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export interface RequestOptions {
  baseUrl: string;
  path: string;
  token?: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function buildUrl({ baseUrl, path, query }: RequestOptions): string {
  const url = joinUrl(baseUrl, path);
  if (!query) return url;
  const params = Object.entries(query)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return params.length ? `${url}?${params.join('&')}` : url;
}

/** Perform a request, classify failures, and return the raw parsed JSON. */
export async function rawRequest(options: RequestOptions): Promise<unknown> {
  const { token, method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;
  const url = buildUrl(options);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Propagate an outer cancellation (React Query unmount) into ours.
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Token ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      // Never send cookies on a REST call. The password-login bootstrap
      // (webForm.ts) seats Django `sessionid`/`csrftoken` cookies in RN's
      // shared jar; if they ride along here, DRF's SessionAuthentication (tried
      // before TokenAuthentication) picks them up and enforces CSRF on unsafe
      // methods — so a token-authenticated DELETE/POST/PATCH fails with
      // "CSRF Failed: CSRF token missing." Omitting credentials keeps the API
      // purely token-authenticated and stateless. The web-form flows keep their
      // own cookie-carrying fetches; only this REST path opts out.
      credentials: 'omit',
    });
  } catch (err) {
    // An abort from our own timer is a timeout; anything else is a transport failure.
    if (controller.signal.aborted && !signal?.aborted) throw new TimeoutError(timeoutMs);
    throw new NetworkError(err instanceof Error ? err.message : undefined);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }

  // Keep the clock offset fresh from every response, including error ones.
  recordServerClock(response.headers.get('date'));

  if (response.status === 401) throw new AuthError();
  if (response.status === 403) {
    // Valid token, forbidden action — surface the server's reason if it gave
    // one, but never as an AuthError (see ForbiddenError).
    const detail = await response.text().catch(() => '');
    throw new ForbiddenError(extractDetail(detail));
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ApiError(response.status, describeError(response.status, detail), detail);
  }

  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

/**
 * Pull the first human-readable message out of a DRF error body. Validation
 * errors are `{"field": ["msg"]}` and permission/auth errors are
 * `{"detail": "msg"}` — both are covered by taking the first string value.
 * Returns undefined when the body isn't JSON or carries no message.
 */
function extractDetail(detail: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(detail);
    if (parsed && typeof parsed === 'object') {
      for (const value of Object.values(parsed as Record<string, unknown>)) {
        const msg = Array.isArray(value) ? value[0] : value;
        if (typeof msg === 'string') return stripHtml(msg);
      }
    }
  } catch {
    // Not JSON — no message to extract.
  }
  return undefined;
}

/** Turn a DRF error body into something worth showing a caregiver. */
function describeError(status: number, detail: string): string {
  if (status === 404) return 'Not found on the server.';
  if (status >= 500) return 'The server had an error. Try again in a moment.';
  return extractDetail(detail) ?? `Request failed (${status}).`;
}

/**
 * Some Django validation messages (e.g. the "conflicting entry" overlap
 * error) embed an `<a href="...">` link meant for the web UI. This app has no
 * HTML renderer for error text, so strip the markup rather than show it raw.
 */
function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, '').trim();
}

/** Perform a request and validate the response against `schema`. */
export async function request<T>(schema: z.ZodType<T>, options: RequestOptions): Promise<T> {
  const json = await rawRequest(options);
  const result = schema.safeParse(json);
  if (!result.success) throw new ParseError(options.path, result.error.issues);
  return result.data;
}

/** Human-readable message for any error this module (or fetch) can produce. */
export function errorMessage(err: unknown): string {
  if (err instanceof ParseError) return err.message;
  if (err instanceof ApiError || err instanceof NetworkError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}
