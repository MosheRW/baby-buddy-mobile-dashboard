/**
 * The "join" QR payload that onboards a caregiver onto a Baby Buddy server
 * without typing (Issue #34). Two shapes, per the feature decision:
 *
 *  - **credentials** — `{ url, username, password }`: the *scanning* device runs
 *    the normal `signInWithPassword` bootstrap itself. This is what the admin
 *    shares for a caregiver account it just created (it knows the password).
 *  - **token** — `{ url, token }`: the scanner runs `signInWithToken`. Used to
 *    share the admin's own already-authenticated session.
 *
 * Encoded as a small versioned JSON string carried by the QR. Pure + tested; the
 * QR rendering and camera live in the UI layer (Batch C).
 */
import { z } from 'zod';
import { normalizeBaseUrl } from '../api/client';
import type { LoginMode } from './../api/types';

/** Bump when the wire shape changes incompatibly; parsers reject other versions. */
export const JOIN_VERSION = 1;

/**
 * Server modes a QR can target. `local` (offline) is never shared. Absent/unknown
 * decodes to `babybuddy` for backward compatibility with v1 codes that had no mode.
 */
export type JoinMode = 'babybuddy' | 'homeassistant';

export type JoinPayload =
  | { kind: 'token'; url: string; token: string; mode: JoinMode }
  | { kind: 'credentials'; url: string; username: string; password: string; mode: JoinMode };

/** Narrow a session `LoginMode` to a shareable `JoinMode` (offline can't be shared). */
export function toJoinMode(mode: LoginMode): JoinMode {
  return mode === 'homeassistant' ? 'homeassistant' : 'babybuddy';
}

/** A scanned string that isn't a Baby Buddy join code (or is an unsupported version). */
export class InvalidJoinError extends Error {
  constructor(message = 'This QR code is not a valid Baby Buddy sign-in code.') {
    super(message);
    this.name = 'InvalidJoinError';
  }
}

const rawSchema = z.object({
  v: z.number(),
  url: z.string(),
  mode: z.string().optional(),
  token: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});

/** Serialize a payload to the QR string. The URL is normalized (https, no trailing /). */
export function encodeJoin(payload: JoinPayload): string {
  const url = normalizeBaseUrl(payload.url);
  const base = { v: JOIN_VERSION, url, mode: payload.mode };
  if (payload.kind === 'token') return JSON.stringify({ ...base, token: payload.token });
  return JSON.stringify({ ...base, username: payload.username, password: payload.password });
}

/**
 * Parse and validate a scanned string into a `JoinPayload`. Throws
 * `InvalidJoinError` on anything that isn't a well-formed, supported code.
 * The token shape wins if a `token` is present.
 */
export function parseJoin(raw: string): JoinPayload {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new InvalidJoinError();
  }

  const result = rawSchema.safeParse(json);
  if (!result.success) throw new InvalidJoinError();

  const data = result.data;
  if (data.v !== JOIN_VERSION) {
    throw new InvalidJoinError(`This sign-in code was made by a newer app version (v${data.v}).`);
  }

  const url = normalizeBaseUrl(data.url);
  if (!url) throw new InvalidJoinError();

  const mode: JoinMode = data.mode === 'homeassistant' ? 'homeassistant' : 'babybuddy';

  if (data.token) return { kind: 'token', url, token: data.token, mode };
  if (data.username && data.password) {
    return { kind: 'credentials', url, username: data.username, password: data.password, mode };
  }
  throw new InvalidJoinError();
}
