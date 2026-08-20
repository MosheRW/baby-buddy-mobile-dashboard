import { canModifyEntry, type EntryOwner } from '../entryOwnership';
import type { Entry } from '../../api/types';

/** Minimal entry with a given author; other fields don't affect ownership. */
function entry(creator: string): Entry {
  return {
    id: 'note:1',
    childId: '1',
    type: 'note',
    time: '2026-08-20T10:00:00Z',
    tags: [],
    creator,
    text: 'x',
  } as Entry;
}

describe('canModifyEntry', () => {
  const caregiver: EntryOwner = { userName: 'Riki', isStaff: false };
  const manager: EntryOwner = { userName: 'Moshe', isStaff: true };

  it('lets a caregiver modify their own entry', () => {
    expect(canModifyEntry(entry('Riki'), caregiver)).toBe(true);
  });

  it("blocks a caregiver from another caregiver's entry", () => {
    expect(canModifyEntry(entry('Moshe'), caregiver)).toBe(false);
  });

  it('lets a staff manager modify anyone’s entry', () => {
    expect(canModifyEntry(entry('Riki'), manager)).toBe(true);
    expect(canModifyEntry(entry('Moshe'), manager)).toBe(true);
  });

  it('blocks a caregiver from an entry with no recorded author', () => {
    // Logged on the web UI / via HA / by an older app version.
    expect(canModifyEntry(entry(''), caregiver)).toBe(false);
    expect(canModifyEntry(entry('   '), caregiver)).toBe(false);
  });

  it('still lets staff modify an authorless entry', () => {
    expect(canModifyEntry(entry(''), manager)).toBe(true);
  });

  it('matches names ignoring surrounding whitespace', () => {
    expect(canModifyEntry(entry(' Riki '), caregiver)).toBe(true);
  });

  it('is case- and identity-sensitive (different name ≠ owner)', () => {
    expect(canModifyEntry(entry('riki'), caregiver)).toBe(false);
  });

  it('returns false when there is no current user', () => {
    expect(canModifyEntry(entry('Riki'), undefined)).toBe(false);
  });

  it('treats a missing isStaff as non-staff (restricted to own)', () => {
    const unknown: EntryOwner = { userName: 'Riki' };
    expect(canModifyEntry(entry('Riki'), unknown)).toBe(true);
    expect(canModifyEntry(entry('Moshe'), unknown)).toBe(false);
  });
});
