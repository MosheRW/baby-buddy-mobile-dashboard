/**
 * Admin-only user management by scraping Baby Buddy's web UI.
 *
 * Why scraping and not the API: Baby Buddy's REST API has no users endpoint and
 * `/api/profile` returns only the *current* user's `api_key`. Listing users and
 * creating a caregiver account are web-only actions (`/users/`, `/users/add/` —
 * Django views gated by `StaffOnlyMixin`). See `docs/SHARE_INSTANCE_PLAN.md`.
 *
 * These pages authenticate by **session cookie**, so a caller must first seat an
 * admin session in the cookie jar via `signInWithPassword` (the same login-form
 * bootstrap the token flow uses). A token alone will not open them.
 *
 * The pure parsers/builders here are unit-tested against HTML fixtures; the thin
 * network wrappers need a live server (there are no fixtures for redirects).
 */
import type { Session } from './types';
import { joinUrl } from './client';
import {
  WebFormError,
  decodeEntities,
  extractCsrfToken,
  getHtml,
  looksLikeLoginPage,
  parseFormError,
  postForm,
} from './webForm';

/** A user parsed from the `/users/` list. Only id + username are reliably scrapable. */
export interface AdminUser {
  id: number;
  username: string;
}

/** The signed-in user isn't staff (or the session lapsed) — the page bounced to login. */
export class NotAdminError extends Error {
  constructor(message = 'You need an admin account on this server to manage caregivers.') {
    super(message);
    this.name = 'NotAdminError';
  }
}

/** The web page loaded but didn't have the shape we expected (version drift, etc.). */
export class AdminWebError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminWebError';
  }
}

/** Fields for creating a caregiver. */
export interface CreateUserInput {
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  /** Grant Django staff/admin status (`is_staff`). */
  isStaff?: boolean;
}

/** A user's API token, read from the Django admin authtoken page. */
export interface UserToken {
  username: string;
  token: string;
}

// --- Pure parsers / builders (unit-tested) ----------------------------------

/**
 * Parse the `/users/` table into `{ id, username }` rows. Baby Buddy renders the
 * username in a `<th scope="row">` and the pk only inside the row's edit/delete
 * action links (`/users/<pk>/edit/`), so we key off both and skip any row missing
 * either. Status columns are icon-only (`bool_icon`) and too brittle to read.
 */
export function parseUserList(html: string): AdminUser[] {
  const users: AdminUser[] = [];
  // Split on row starts; the first chunk is everything before the first <tr>.
  const rows = html.split(/<tr[\s>]/i).slice(1);
  for (const row of rows) {
    const nameMatch = /<th[^>]*scope=["']row["'][^>]*>([\s\S]*?)<\/th>/i.exec(row);
    const idMatch = /\/users\/(\d+)\/(?:edit|delete)\//i.exec(row);
    if (!nameMatch || !idMatch) continue;
    const username = decodeEntities(nameMatch[1].replace(/<[^>]+>/g, '').trim());
    if (username) users.push({ id: Number(idMatch[1]), username });
  }
  return users;
}

/**
 * Build the `UserAddForm` POST body for a read+write caregiver.
 *
 * Baby Buddy's user form has **no granular permission tier**: its `save()` sets
 * `is_superuser = True` for every account whose `is_read_only` box is unchecked
 * (and `False` + membership of the `read_only` group when it's checked). So
 * *omitting* `is_read_only` here is exactly what gives a new caregiver full
 * read/write/delete access — a writing caregiver is, at the Django level, a
 * superuser. There is no "can write but only see, not manage" option on the
 * server; the app's own `canModifyEntry` guard is what keeps caregivers to
 * their own entries (see src/lib/entryOwnership.ts).
 *
 * `is_staff` (Django admin-site access) is a separate, opt-in checkbox — also
 * omitted unless requested. `is_active` must be present.
 */
export function buildCreateUserForm(csrf: string, input: CreateUserInput): Record<string, string> {
  const form: Record<string, string> = {
    csrfmiddlewaretoken: csrf,
    username: input.username,
    first_name: input.firstName ?? '',
    last_name: input.lastName ?? '',
    email: '',
    password1: input.password,
    password2: input.password,
    is_active: 'on',
  };
  // Django checkboxes are true iff present; omit for a non-staff user.
  if (input.isStaff) form.is_staff = 'on';
  return form;
}

/**
 * Parse the Django admin authtoken list (`/admin/authtoken/tokenproxy/`) into
 * `{ username, token }` rows. The admin list renders one 40-hex `key` per row in
 * a `field-key` cell and the user in a `field-user` cell; we key off both and
 * skip any row missing either. This is the (multi-caregiver) way to obtain a
 * user's real API token without knowing their password.
 */
export function parseTokenList(html: string): UserToken[] {
  const tokens: UserToken[] = [];
  const rows = html.split(/<tr[\s>]/i).slice(1);
  for (const row of rows) {
    const keyMatch = /class=["'][^"']*field-key[^"']*["'][^>]*>([\s\S]*?)<\/(?:th|td)>/i.exec(row);
    const userMatch = /class=["'][^"']*field-user[^"']*["'][^>]*>([\s\S]*?)<\/td>/i.exec(row);
    if (!keyMatch || !userMatch) continue;
    const token = (keyMatch[1].replace(/<[^>]+>/g, '').match(/[0-9a-f]{40}/i) ?? [])[0];
    const username = decodeEntities(userMatch[1].replace(/<[^>]+>/g, '').trim());
    if (token && username) tokens.push({ username, token });
  }
  return tokens;
}

// --- Network wrappers (need a live admin session; integration-tested) --------

/** GET `/users/` with the ambient admin session and parse the list. */
export async function listUsers(session: Session): Promise<AdminUser[]> {
  const url = joinUrl(session.baseUrl, 'users/');
  const html = await getHtml(url);
  if (looksLikeLoginPage(html)) throw new NotAdminError();
  return parseUserList(html);
}

/**
 * Force-create an API token for a user via the Django admin authtoken **add**
 * page (`/admin/authtoken/tokenproxy/add/`), whose only field is the user and
 * which auto-generates the key on save. Baby Buddy otherwise creates a user's
 * token lazily (on their first API call), so a brand-new caregiver has none —
 * which is fatal for Home Assistant, where a QR *must* carry a token. Idempotent
 * in effect: if the user already has a token the form reports a duplicate, which
 * the caller treats as success (the token is then readable from the list).
 */
export async function createToken(session: Session, userId: number): Promise<void> {
  const url = joinUrl(session.baseUrl, 'admin/authtoken/tokenproxy/add/');
  const html = await getHtml(url);
  if (looksLikeLoginPage(html)) throw new NotAdminError();
  const csrf = extractCsrfToken(html);
  if (!csrf) throw new AdminWebError('Could not read the token form on this server.');

  const res = await postForm(
    url,
    { csrfmiddlewaretoken: csrf, user: String(userId), _save: 'Save' },
    { referer: url },
  );
  if (res.status >= 400) {
    throw new AdminWebError(`Creating the token failed (HTTP ${res.status}).`);
  }
  const formError = parseFormError(res.text);
  // A OneToOne "already exists" is fine — the token is there to read.
  if (formError && !/exist/i.test(formError)) throw new AdminWebError(formError);
}

/**
 * Read every user's API token from the Django admin authtoken page. Requires a
 * **superuser/staff** session with admin access (broader than the `/users/`
 * page). `?all=` disables the admin's pagination so one request covers a
 * family-sized server. Throws `NotAdminError` if the admin login gate bounces us.
 */
export async function listUserTokens(session: Session): Promise<UserToken[]> {
  const url = `${joinUrl(session.baseUrl, 'admin/authtoken/tokenproxy/')}?all=`;
  const html = await getHtml(url);
  if (looksLikeLoginPage(html) || /id=["']login-form["']/.test(html)) throw new NotAdminError();
  return parseTokenList(html);
}

/**
 * Create a non-admin caregiver via `/users/add/`. Reads the form for its CSRF
 * token, then POSTs. A successful submit redirects to `/users/`; a rejection
 * re-renders the form with an `errorlist` (e.g. duplicate username).
 */
export async function createUser(session: Session, input: CreateUserInput): Promise<void> {
  const url = joinUrl(session.baseUrl, 'users/add/');
  const html = await getHtml(url);
  if (looksLikeLoginPage(html)) throw new NotAdminError();

  const csrf = extractCsrfToken(html);
  if (!csrf) throw new AdminWebError('Could not read the add-user form on this server.');

  const res = await postForm(url, buildCreateUserForm(csrf, input), { referer: url });
  if (res.status >= 400) {
    throw new AdminWebError(`The server rejected the new user (HTTP ${res.status}).`);
  }
  if (looksLikeLoginPage(res.text)) throw new NotAdminError();

  const formError = parseFormError(res.text);
  if (formError) throw new AdminWebError(formError);
}

export { WebFormError };
