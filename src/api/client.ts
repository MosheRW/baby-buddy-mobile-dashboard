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

/** 401/403 — a bad or revoked token. Callers sign the user out on this. */
export class AuthError extends ApiError {
  constructor(message = 'Your session is no longer valid. Please log in again.') {
    super(401, message);
    this.name = 'AuthError';
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
    });
  } catch (err) {
    // An abort from our own timer is a timeout; anything else is a transport failure.
    if (controller.signal.aborted && !signal?.aborted) throw new TimeoutError(timeoutMs);
    throw new NetworkError(err instanceof Error ? err.message : undefined);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }

  if (response.status === 401 || response.status === 403) throw new AuthError();

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ApiError(response.status, describeError(response.status, detail), detail);
  }

  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

/** Turn a DRF error body into something worth showing a caregiver. */
function describeError(status: number, detail: string): string {
  if (status === 404) return 'Not found on the server.';
  if (status >= 500) return 'The server had an error. Try again in a moment.';
  // DRF validation errors are {"field": ["msg"]} — surface the first message.
  try {
    const parsed: unknown = JSON.parse(detail);
    if (parsed && typeof parsed === 'object') {
      for (const value of Object.values(parsed as Record<string, unknown>)) {
        const msg = Array.isArray(value) ? value[0] : value;
        if (typeof msg === 'string') return msg;
      }
    }
  } catch {
    // Not JSON — fall through.
  }
  return `Request failed (${status}).`;
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
