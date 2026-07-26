/**
 * Weekly caregiver-contribution summary — pure, unit-tested.
 *
 * Baby Buddy is multi-caregiver: every entry records *who* logged it (`creator`,
 * surfaced as the "by {creator}" author tag). This module turns the fetched
 * timeline into "what did I log this week, per category, and how does that
 * compare with the other caregivers on this server". It powers the weekly
 * summary notification (see `buildNotifications` in `./notifications`), but it is
 * deliberately UI-agnostic: the math is here, the scheduling is there.
 *
 * "The rest of the users" means the other caregivers on the *same* self-hosted
 * server — there is no cross-server aggregation, so this never leaves the device.
 */
import i18n from '../i18n';
import type { Child, Entry, EntryType } from '../api/types';
import { entryTypeLabel } from './entryDisplay';
import { groupForChild, type KidsVisibilityState } from './visibility';

const DAY = 24 * 60 * 60_000;

/** Default trailing window the weekly summary covers. */
export const SUMMARY_WINDOW_DAYS = 7;

/**
 * Canonical order categories are listed in, so the breakdown reads the same way
 * every week regardless of which type happened to be busiest.
 */
const CATEGORY_ORDER: EntryType[] = [
  'diaper',
  'feeding',
  'medication',
  'sleep',
  'tummyTime',
  'temperature',
  'note',
];

export interface CategoryContribution {
  type: EntryType;
  /** How many of this category I logged in the window. */
  mine: number;
  /** How many everyone (me included) logged in the window. */
  total: number;
}

export interface ContributionSummary {
  windowDays: number;
  /** Total entries I logged across all categories in the window. */
  myTotal: number;
  /** Total entries everyone logged in the window. */
  allTotal: number;
  /** My share of `allTotal`, 0..1 (0 when nothing was logged). */
  overallShare: number;
  /** Distinct caregivers who logged anything in the window, me included. */
  caregivers: number;
  /** Only categories with `total > 0`, in canonical order. */
  categories: CategoryContribution[];
}

/** Trim + lowercase so "Sarah " and "sarah" count as the same caregiver. */
function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Tally each caregiver's entries per category over the trailing `windowDays`.
 * `me` is matched against `entry.creator` by normalized name (the same value the
 * session stamps as the author tag), so a caregiver's own contribution is
 * whatever they logged, not whatever device did the logging.
 */
export function computeContribution(
  entries: Entry[],
  me: string,
  now: number = Date.now(),
  windowDays: number = SUMMARY_WINDOW_DAYS,
): ContributionSummary {
  const cutoff = now - windowDays * DAY;
  const meKey = nameKey(me);

  const mine = new Map<EntryType, number>();
  const total = new Map<EntryType, number>();
  const caregivers = new Set<string>();

  let myTotal = 0;
  let allTotal = 0;

  for (const e of entries) {
    const at = new Date(e.time).getTime();
    if (Number.isNaN(at) || at < cutoff || at > now) continue;

    total.set(e.type, (total.get(e.type) ?? 0) + 1);
    allTotal += 1;
    caregivers.add(nameKey(e.creator));

    if (meKey.length > 0 && nameKey(e.creator) === meKey) {
      mine.set(e.type, (mine.get(e.type) ?? 0) + 1);
      myTotal += 1;
    }
  }

  const categories: CategoryContribution[] = CATEGORY_ORDER.filter(
    (type) => (total.get(type) ?? 0) > 0,
  ).map((type) => ({ type, mine: mine.get(type) ?? 0, total: total.get(type) ?? 0 }));

  return {
    windowDays,
    myTotal,
    allTotal,
    overallShare: allTotal > 0 ? myTotal / allTotal : 0,
    caregivers: caregivers.size,
    categories,
  };
}

/**
 * One bucket of the grouped breakdown: a kid group, or a single ungrouped
 * child standing in for itself.
 */
export interface GroupContribution {
  /** Group id, or the child id when this bucket is one ungrouped child. */
  id: string;
  /** Group name, or the child's name. */
  label: string;
  /** True when `id`/`label` came from a `KidGroup` rather than a lone child. */
  isGroup: boolean;
  /** Children in this bucket, in input order. */
  childIds: string[];
  summary: ContributionSummary;
}

/** Only the entries logged for one of `childIds`. */
export function entriesForChildren(entries: Entry[], childIds: string[]): Entry[] {
  const wanted = new Set(childIds);
  return entries.filter((e) => wanted.has(e.childId));
}

/**
 * The same tally, split by kid group.
 *
 * `children` is expected to be **already visibility-filtered** by the caller
 * (`visibleChildren`), so a hidden child — or a child in a hidden group —
 * contributes to neither the buckets nor the totals. That filtering stays with
 * the caller because visibility depends on `now` + reveal state, which is a UI
 * concern; this function only needs the surviving children and their grouping.
 *
 * A child that belongs to no group becomes a bucket of its own rather than
 * being pooled into an "ungrouped" catch-all: with no groups configured at all
 * (the common case) that reads as a plain per-child breakdown, which is the
 * useful thing to show, not a single bucket labelled "other".
 */
export function computeGroupContributions(
  entries: Entry[],
  children: Child[],
  state: Pick<KidsVisibilityState, 'childGroupId' | 'groups'>,
  me: string,
  now: number = Date.now(),
  windowDays: number = SUMMARY_WINDOW_DAYS,
): GroupContribution[] {
  const buckets: GroupContribution[] = [];
  const byId = new Map<string, GroupContribution>();

  for (const child of children) {
    const group = groupForChild(child.id, state);
    const id = group?.id ?? child.id;
    const existing = byId.get(id);
    if (existing) {
      existing.childIds.push(child.id);
      continue;
    }
    const bucket: GroupContribution = {
      id,
      label: group?.name ?? child.name,
      isGroup: group != null,
      childIds: [child.id],
      // Filled in below, once every member of the bucket is known.
      summary: computeContribution([], me, now, windowDays),
    };
    byId.set(id, bucket);
    buckets.push(bucket);
  }

  for (const bucket of buckets) {
    bucket.summary = computeContribution(
      entriesForChildren(entries, bucket.childIds),
      me,
      now,
      windowDays,
    );
  }

  return buckets;
}

/**
 * Localized notification body for a summary. When I'm the only caregiver who
 * logged anything, the "% of the family's total" comparison is meaningless, so a
 * solo variant drops it and just recaps my own counts. Categories are joined
 * with a middot into one line the OS can expand.
 */
export function contributionBody(summary: ContributionSummary): string {
  const solo = summary.caregivers <= 1;

  const breakdown = summary.categories
    .map((c) =>
      solo
        ? `${entryTypeLabel(c.type)} ${c.mine}`
        : `${entryTypeLabel(c.type)} ${c.mine}/${c.total}`,
    )
    .join(' · ');

  if (solo) {
    return i18n.t('notifications.weeklyBodySolo', {
      mine: summary.myTotal,
      breakdown,
    });
  }

  return i18n.t('notifications.weeklyBody', {
    mine: summary.myTotal,
    total: summary.allTotal,
    share: Math.round(summary.overallShare * 100),
    breakdown,
  });
}
