import { filterByTag, isSelectableTag, recentTagSuggestions, selectableTagLabels } from '../tags';
import type { Entry, EntryType, Tag } from '../../api/types';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date('2026-07-19T12:00:00Z').getTime();
const iso = (ms: number) => new Date(ms).toISOString();

function entry(
  id: string,
  type: EntryType,
  time: number,
  labels: (string | Tag)[] = [],
): Entry {
  const tags: Tag[] = labels.map((l) => (typeof l === 'string' ? { label: l } : l));
  const base = { id, childId: 'c1', time: iso(time), tags, creator: 'Sarah' };
  switch (type) {
    case 'diaper':
      return { ...base, type: 'diaper', pee: true, poo: false };
    case 'feeding':
      return { ...base, type: 'feeding', kind: 'formula', method: 'bottle' };
    default:
      return { ...base, type: 'note', note: '' };
  }
}

describe('selectable tags', () => {
  it('rejects the author tag and any reserved tag', () => {
    expect(isSelectableTag({ label: 'by Sarah', author: true })).toBe(false);
    expect(isSelectableTag({ label: '__unit:paste' })).toBe(false);
    expect(isSelectableTag({ label: 'daycare' })).toBe(true);
  });

  it('filters both out of an entry label list', () => {
    const e = entry('a', 'feeding', NOW, [
      { label: 'by Sarah', author: true },
      '__defaultqty:120',
      'daycare',
    ]);
    expect(selectableTagLabels(e)).toEqual(['daycare']);
  });
});

describe('recentTagSuggestions', () => {
  it('scopes suggestions to the entry type', () => {
    const entries = [
      entry('a', 'feeding', NOW - HOUR, ['spat up']),
      entry('b', 'diaper', NOW - HOUR, ['blowout']),
    ];
    expect(recentTagSuggestions(entries, 'feeding', { now: NOW })).toEqual(['spat up']);
    expect(recentTagSuggestions(entries, 'diaper', { now: NOW })).toEqual(['blowout']);
  });

  it('orders by most recent use, not by frequency', () => {
    const entries = [
      entry('a', 'feeding', NOW - 10 * DAY, ['old']),
      entry('b', 'feeding', NOW - 9 * DAY, ['old']),
      entry('c', 'feeding', NOW - 8 * DAY, ['old']),
      entry('d', 'feeding', NOW - HOUR, ['fresh']),
    ];
    expect(recentTagSuggestions(entries, 'feeding', { now: NOW })).toEqual(['fresh', 'old']);
  });

  it('ignores entries older than the window', () => {
    const entries = [entry('a', 'feeding', NOW - 40 * DAY, ['ancient'])];
    expect(recentTagSuggestions(entries, 'feeding', { now: NOW })).toEqual([]);
  });

  it('caps the list', () => {
    const entries = Array.from({ length: 9 }, (_, i) =>
      entry(`e${i}`, 'feeding', NOW - i * HOUR, [`tag${i}`]),
    );
    expect(recentTagSuggestions(entries, 'feeding', { now: NOW })).toHaveLength(5);
  });

  it('excludes tags already on the draft', () => {
    const entries = [entry('a', 'feeding', NOW - HOUR, ['spat up', 'daycare'])];
    expect(
      recentTagSuggestions(entries, 'feeding', { now: NOW, exclude: ['daycare'] }),
    ).toEqual(['spat up']);
  });

  it('never suggests an author or reserved tag', () => {
    const entries = [
      entry('a', 'feeding', NOW - HOUR, [
        { label: 'by Sarah', author: true },
        '__foodtype:fruits',
        'daycare',
      ]),
    ];
    expect(recentTagSuggestions(entries, 'feeding', { now: NOW })).toEqual(['daycare']);
  });
});

describe('filterByTag', () => {
  it('keeps only entries carrying the tag', () => {
    const entries = [
      entry('a', 'feeding', NOW, ['daycare']),
      entry('b', 'feeding', NOW, ['home']),
    ];
    expect(filterByTag(entries, 'daycare').map((e) => e.id)).toEqual(['a']);
  });

  it('cannot be used to filter by a reserved tag', () => {
    const entries = [entry('a', 'feeding', NOW, ['__foodtype:fruits'])];
    expect(filterByTag(entries, '__foodtype:fruits')).toEqual([]);
  });
});
