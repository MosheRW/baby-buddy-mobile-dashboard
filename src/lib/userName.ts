/**
 * Username ↔ display-name conversion.
 *
 * Django usernames can't contain spaces, so a caregiver called "Grand Ma" is
 * stored as `Grand_Ma`. These two pure helpers are the only place that mapping
 * lives: `sanitizeUsername` on the way in (the create-caregiver field) and
 * `displayUserName` on the way out (greeting, author chips).
 *
 * Deliberately display-only in the second direction: the `by {creator}` author
 * tag is **wire format** parsed by prefix (see api/normalize.ts), so the stored
 * label keeps its underscores — only the rendered text is prettified.
 */

/**
 * Make user input safe as a Django username: collapse whitespace runs to a
 * single `_` and drop leading/trailing whitespace. Other characters are left
 * alone — the server is the authority on the rest of its own validation.
 */
export function sanitizeUsername(input: string): string {
  return input.trim().replace(/\s+/g, '_');
}

/** Render a stored username for humans: underscores read as spaces. */
export function displayUserName(name: string): string {
  return name.replace(/_/g, ' ');
}
