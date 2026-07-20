/**
 * Tag helpers for the log-entry form's quick-pick row and the feed's
 * tap-to-filter. Pure and unit-tested.
 *
 * Reserved `__key:value` tags are stripped at the API boundary (see
 * `api/normalize.ts`), so by the time entries reach here a `Tag[]` should
 * already contain only real tags. These functions filter defensively anyway —
 * a reserved tag surfacing as a one-tap chip, or as a feed filter, is exactly
 * the leak the scheme exists to prevent.
 */
import type { Entry, EntryType, Tag } from '../api/types';

const DAY = 24 * 60 * 60 * 1000;
const RESERVED_PREFIX = '__';

/** Author tags and reserved tags are never offered as suggestions or filters. */
export function isSelectableTag(tag: Tag): boolean {
  return !tag.author && !tag.label.startsWith(RESERVED_PREFIX);
}

/** The labels of an entry's tags that a user may filter or re-apply. */
export function selectableTagLabels(entry: Entry): string[] {
  return entry.tags.filter(isSelectableTag).map((t) => t.label);
}

/**
 * Up to `limit` recently-used tags for this entry type, most recently used
 * first.
 *
 * Scoped by type rather than globally: the tags that are useful on a feeding
 * ("left side", "spat up") are not the ones useful on a medication. Looks
 * across all children, since a caregiver's vocabulary is theirs, not the
 * child's.
 */
export function recentTagSuggestions(
  entries: Entry[],
  type: EntryType,
  options: { limit?: number; days?: number; exclude?: string[]; now?: number } = {},
): string[] {
  const { limit = 5, days = 30, exclude = [], now = Date.now() } = options;
  const cutoff = now - days * DAY;
  const excluded = new Set(exclude);

  // Most recent use wins, so a tag used today outranks one used three weeks ago
  // even if the older one appears on more entries.
  const lastUsed = new Map<string, number>();
  for (const entry of entries) {
    if (entry.type !== type) continue;
    const at = new Date(entry.time).getTime();
    if (!Number.isFinite(at) || at < cutoff) continue;
    for (const label of selectableTagLabels(entry)) {
      if (excluded.has(label)) continue;
      const prev = lastUsed.get(label);
      if (prev == null || at > prev) lastUsed.set(label, at);
    }
  }

  return [...lastUsed.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label]) => label);
}

/** Entries carrying a given tag — the feed's tap-to-filter. */
export function filterByTag(entries: Entry[], tag: string): Entry[] {
  return entries.filter((e) => selectableTagLabels(e).includes(tag));
}
