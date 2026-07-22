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
import type { Entry, EntryType } from '../api/types';
import { entryTypeLabel } from './entryDisplay';

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
