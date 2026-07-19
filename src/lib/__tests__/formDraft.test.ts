import type { DiaperEntry, FeedingEntry, MedicationEntry, SleepEntry } from '../../api/types';
import {
  amountUnit,
  draftToEntry,
  emptyDraft,
  entryToDraft,
  isCustomRepeat,
  isDirectBreast,
  methodForKindChange,
  methodsForKind,
  repeatLabel,
  showsAmount,
  showsDuration,
} from '../formDraft';

const NOW = Date.parse('2026-07-19T10:00:00.000Z');

function makeDraft(patch: Partial<ReturnType<typeof emptyDraft>> = {}) {
  return { ...emptyDraft(NOW), ...patch };
}

describe('emptyDraft', () => {
  it('seeds the amount from the child default food quantity', () => {
    expect(emptyDraft(NOW, 150).amount).toBe(150);
  });

  it('starts at the given time with no end time', () => {
    const d = emptyDraft(NOW);
    expect(d.time).toBe('2026-07-19T10:00:00.000Z');
    expect(d.endTime).toBeNull();
  });
});

describe('feeding method options', () => {
  it('offers bottle + the three breast options for breast milk', () => {
    expect(methodsForKind('breastMilk')).toEqual([
      'bottle',
      'leftBreast',
      'rightBreast',
      'bothBreasts',
    ]);
  });

  it('offers bottle only for formula and fortified breast milk', () => {
    expect(methodsForKind('formula')).toEqual(['bottle']);
    expect(methodsForKind('fortifiedBreastMilk')).toEqual(['bottle']);
  });

  it('offers self/parent fed for solids', () => {
    expect(methodsForKind('solidFood')).toEqual(['selfFed', 'parentFed']);
  });

  it('keeps a still-valid method when the kind changes', () => {
    expect(methodForKindChange('formula', 'bottle')).toBe('bottle');
  });

  it('falls back to the first option when the method is no longer offered', () => {
    // Left breast isn't a formula option, so it must fall back to bottle.
    expect(methodForKindChange('formula', 'leftBreast')).toBe('bottle');
    expect(methodForKindChange('solidFood', 'bottle')).toBe('selfFed');
  });
});

describe('feeding field visibility', () => {
  it('treats the three breast methods as direct breast', () => {
    expect(isDirectBreast('leftBreast')).toBe(true);
    expect(isDirectBreast('rightBreast')).toBe(true);
    expect(isDirectBreast('bothBreasts')).toBe(true);
    expect(isDirectBreast('bottle')).toBe(false);
  });

  it('shows amount for bottle feeds and for solids', () => {
    expect(showsAmount('breastMilk', 'bottle')).toBe(true);
    expect(showsAmount('solidFood', 'selfFed')).toBe(true);
    expect(showsAmount('breastMilk', 'leftBreast')).toBe(false);
  });

  it('shows duration only for direct breast with no timer running', () => {
    expect(showsDuration('leftBreast', false)).toBe(true);
    expect(showsDuration('leftBreast', true)).toBe(false);
    expect(showsDuration('bottle', false)).toBe(false);
  });

  it('uses grams for solids and ml otherwise', () => {
    expect(amountUnit('solidFood')).toBe(' g');
    expect(amountUnit('formula')).toBe(' ml');
  });
});

describe('medication repeat interval', () => {
  it('recognises the preset intervals', () => {
    expect(isCustomRepeat(6)).toBe(false);
    expect(isCustomRepeat(12)).toBe(false);
  });

  it('treats anything off-preset as custom', () => {
    expect(isCustomRepeat(6.5)).toBe(true);
    expect(isCustomRepeat(24)).toBe(true);
  });

  it('labels the interval by schedule type', () => {
    expect(repeatLabel('scheduled')).toBe('Repeat next dose in');
    expect(repeatLabel('asNeeded')).toBe('Eligible again after');
  });
});

describe('draftToEntry', () => {
  const common = { childId: 'c1', id: 'new-1', creator: 'Sarah' };

  it('adds the non-removable author tag ahead of free-text tags', () => {
    const entry = draftToEntry({ ...common, type: 'note', draft: makeDraft({ tags: ['walk'] }) });
    expect(entry.tags).toEqual([{ label: 'by Sarah', author: true }, { label: 'walk' }]);
  });

  it('drops an empty note rather than storing a blank string', () => {
    const entry = draftToEntry({ ...common, type: 'note', draft: makeDraft({ note: '   ' }) });
    expect(entry.note).toBeUndefined();
  });

  it('keeps pee and poo independent', () => {
    const both = draftToEntry({
      ...common,
      type: 'diaper',
      draft: makeDraft({ pee: true, poo: true }),
    }) as DiaperEntry;
    expect(both.pee).toBe(true);
    expect(both.poo).toBe(true);
  });

  it('only records a poo color when poo is on', () => {
    const peeOnly = draftToEntry({
      ...common,
      type: 'diaper',
      draft: makeDraft({ pee: true, poo: false, pooColor: 'green' }),
    }) as DiaperEntry;
    expect(peeOnly.pooColor).toBeUndefined();

    const withPoo = draftToEntry({
      ...common,
      type: 'diaper',
      draft: makeDraft({ poo: true, pooColor: 'green' }),
    }) as DiaperEntry;
    expect(withPoo.pooColor).toBe('green');
  });

  it('omits amount for direct-breast feeds and duration for bottle feeds', () => {
    const breast = draftToEntry({
      ...common,
      type: 'feeding',
      draft: makeDraft({ kind: 'breastMilk', method: 'leftBreast', durationMinutes: 20 }),
    }) as FeedingEntry;
    expect(breast.amount).toBeUndefined();
    expect(breast.durationMinutes).toBe(20);

    const bottle = draftToEntry({
      ...common,
      type: 'feeding',
      draft: makeDraft({ kind: 'formula', method: 'bottle', amount: 90 }),
    }) as FeedingEntry;
    expect(bottle.amount).toBe(90);
    expect(bottle.durationMinutes).toBeUndefined();
  });

  it('corrects a method the selected kind no longer offers', () => {
    const entry = draftToEntry({
      ...common,
      type: 'feeding',
      draft: makeDraft({ kind: 'formula', method: 'bothBreasts' }),
    }) as FeedingEntry;
    expect(entry.method).toBe('bottle');
  });

  it('trims the medicine name', () => {
    const entry = draftToEntry({
      ...common,
      type: 'medication',
      draft: makeDraft({ medName: '  Tylenol ' }),
    }) as MedicationEntry;
    expect(entry.name).toBe('Tylenol');
  });

  it('leaves an ongoing sleep without an end time', () => {
    const sleeping = draftToEntry({
      ...common,
      type: 'sleep',
      draft: makeDraft({ stillSleeping: true, endTime: '2026-07-19T11:00:00.000Z' }),
    }) as SleepEntry;
    expect(sleeping.ongoing).toBe(true);
    expect(sleeping.endTime).toBeUndefined();
  });

  it('records the end time once sleep is no longer ongoing', () => {
    const woke = draftToEntry({
      ...common,
      type: 'sleep',
      draft: makeDraft({ stillSleeping: false, endTime: '2026-07-19T11:00:00.000Z' }),
    }) as SleepEntry;
    expect(woke.ongoing).toBe(false);
    expect(woke.endTime).toBe('2026-07-19T11:00:00.000Z');
  });
});

describe('entryToDraft', () => {
  it('round-trips a feeding entry', () => {
    const entry = draftToEntry({
      childId: 'c1',
      id: 'e1',
      creator: 'Sarah',
      type: 'feeding',
      draft: makeDraft({ kind: 'solidFood', method: 'parentFed', amount: 40, note: 'peas' }),
    });
    const draft = entryToDraft(entry);
    expect(draft.kind).toBe('solidFood');
    expect(draft.method).toBe('parentFed');
    expect(draft.amount).toBe(40);
    expect(draft.note).toBe('peas');
  });

  it('strips the author tag so it is not editable or duplicated on re-save', () => {
    const entry = draftToEntry({
      childId: 'c1',
      id: 'e1',
      creator: 'Sarah',
      type: 'note',
      draft: makeDraft({ tags: ['nap'] }),
    });
    expect(entryToDraft(entry).tags).toEqual(['nap']);

    // Re-saving must not accumulate a second author tag.
    const resaved = draftToEntry({
      childId: 'c1',
      id: 'e1',
      creator: 'Sarah',
      type: 'note',
      draft: { ...emptyDraft(NOW), ...entryToDraft(entry) },
    });
    expect(resaved.tags.filter((t) => t.author)).toHaveLength(1);
  });
});
