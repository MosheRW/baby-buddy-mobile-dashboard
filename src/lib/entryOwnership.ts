/**
 * App-level "who may edit or delete this entry" rule.
 *
 * Baby Buddy can't enforce this. Its permission model is binary: a caregiver
 * who can write at all is a Django **superuser** (the user form sets
 * `is_superuser = True` for every non-read-only account), so the server lets
 * anyone who can write touch *any* entry — there is no "read+write but only my
 * own rows" tier. Restricting a caregiver to their own entries is therefore a
 * client-only convention, layered on the "by {creator}" author tag this app
 * stamps on create (see api/normalize.ts). Any other Baby Buddy client bypasses
 * it — this is a UI guard, not a security boundary.
 *
 * The rule:
 *  - A **staff** account (the manager who onboards caregivers) may modify
 *    anything — they're the one person expected to correct others' entries.
 *  - Anyone else may modify only the entries they logged, matched by author.
 *  - An entry with no recorded author (logged on the Baby Buddy web UI, via
 *    Home Assistant, or by an older app version) is treated as *not* the
 *    current caregiver's, so a non-staff caregiver can't edit it. That's the
 *    conservative reading of "only their own", and staff can still touch it.
 */
import type { Entry } from '../api/types';

export interface EntryOwner {
  /** The current user's display name — compared to `entry.creator`. */
  userName: string;
  /** Django staff: the manager, allowed to modify every caregiver's entries. */
  isStaff?: boolean;
}

export function canModifyEntry(entry: Entry, user: EntryOwner | undefined): boolean {
  if (!user) return false;
  if (user.isStaff) return true;
  const creator = entry.creator?.trim();
  return creator.length > 0 && creator === user.userName.trim();
}
