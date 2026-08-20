/**
 * Shared helpers for driving Baby Buddy's HTML web pages (login form, user
 * management) rather than its REST API. These pages are plain Django views gated
 * by the **session cookie**, not DRF token auth — so anything here relies on the
 * platform cookie jar (React Native's `fetch` has one; a browser blocks it
 * cross-origin, which is why web QA can't exercise this path).
 *
 * The CSRF + form-POST mechanics were first written inline in `auth.ts` for the
 * password login bootstrap; they're factored out here so the admin user-
 * management scraping (`adminWeb.ts`) reuses exactly the same, battle-tested flow.
 */
import { NetworkError } from './client';

/** A web page returned a non-2xx we can't recover from. */
export class WebFormError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'WebFormError';
  }
}

/** Pull Django's CSRF token out of a form page's hidden input. */
export function extractCsrfToken(html: string): string | null {
  const m = /name=["']csrfmiddlewaretoken["']\s+value=["']([^"']+)["']/.exec(html);
  return m ? m[1] : null;
}

/** GET an HTML page, classifying transport vs. HTTP failures. */
export async function getHtml(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { Accept: 'text/html' } });
    if (!res.ok) throw new WebFormError(`The page at ${url} returned ${res.status}.`, res.status);
    return await res.text();
  } catch (err) {
    if (err instanceof WebFormError) throw err;
    throw new NetworkError(err instanceof Error ? err.message : undefined);
  }
}

export interface PostResult {
  status: number;
  /** The response body after any redirects were followed. */
  text: string;
  /** The final URL after redirects — a redirect away from the form usually means success. */
  finalUrl: string;
}

/**
 * POST a Django form as `application/x-www-form-urlencoded`, following redirects.
 * Sets `Referer` (Django rejects HTTPS form POSTs without a matching one).
 */
export async function postForm(
  url: string,
  fields: Record<string, string>,
  opts: { referer?: string } = {},
): Promise<PostResult> {
  const body = new URLSearchParams(fields).toString();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: opts.referer ?? url,
        Accept: 'text/html',
      },
      body,
      redirect: 'follow',
    });
    return { status: res.status, text: await res.text(), finalUrl: res.url };
  } catch (err) {
    throw new NetworkError(err instanceof Error ? err.message : undefined);
  }
}

/**
 * A staff-only page hit without a valid staff session re-renders Baby Buddy's
 * **login form** (Django `LoginRequiredMixin`/`StaffOnlyMixin` redirect to
 * `/login/?next=…`). Both username and password inputs present = we're looking
 * at the login page, not the page we asked for.
 */
export function looksLikeLoginPage(html: string): boolean {
  return /name=["']username["']/.test(html) && /name=["']password["']/.test(html);
}

/**
 * Recover the first Django form-validation message from a re-rendered form —
 * e.g. "A user with that username already exists." A successful submit redirects
 * away, so the presence of an `errorlist` means the submit was rejected.
 */
export function parseFormError(html: string): string | null {
  const m = /<ul[^>]*class=["'][^"']*errorlist[^"']*["'][^>]*>\s*<li>([\s\S]*?)<\/li>/i.exec(html);
  return m ? decodeEntities(m[1].replace(/<[^>]+>/g, '').trim()) : null;
}

/** Minimal HTML-entity decode for scraped text (usernames, error messages). */
export function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}
