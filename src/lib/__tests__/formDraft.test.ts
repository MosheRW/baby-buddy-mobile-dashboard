import type {
  DiaperEntry,
  Entry,
  FeedingEntry,
  MedicationEntry,
  SleepEntry,
} from '../../api/types';
import {
  amountUnit,
  baselinePatch,
  defaultSleepType,
  diaperAmountLabel,
  draftSaveError,
  draftToEntry,
  emptyDraft,
  entryToDraft,
  isCustomRepeat,
  isDirectBreast,
  isNoRepeat,
  medSuggestionPatch,
  methodForKindChange,
  methodsForKind,
  mostRecentOfType,
  repeatLabel,
  seedDraft,
  showsAmount,
  showsBodyArea,
  showsDose,
  showsDuration,
  showsMaxDose,
  showsRoute,
} from '../formDraft';
import { medLimitSummaries } from '../medication';

const NOW = Date.parse('2026-07-19T10:00:00.000Z');

function makeDraft(patch: Partial<ReturnType<typeof emptyDraft>> = {}) {
  return { ...emptyDraft(NOW), ...patch };
}

describe('draftSaveError', () => {
  it('rejects a diaper with neither pee nor poo', () => {
    expect(draftSaveError(makeDraft({ pee: false, poo: false }), 'diaper')).toBeTruthy();
  });

  it('allows a diaper with pee, poo, or both', () => {
    expect(draftSaveError(makeDraft({ pee: true, poo: false }), 'diaper')).toBeUndefined();
    expect(draftSaveError(makeDraft({ pee: false, poo: true }), 'diaper')).toBeUndefined();
    expect(draftSaveError(makeDraft({ pee: true, poo: true }), 'diaper')).toBeUndefined();
  });

  it('does not gate other entry types on the diaper toggles', () => {
    expect(draftSaveError(makeDraft({ pee: false, poo: false }), 'feeding')).toBeUndefined();
    expect(draftSaveError(makeDraft({ pee: false, poo: false }), 'note')).toBeUndefined();
  });
});

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
    expect(showsAmount('breastMilk', 'bottle', 'grains')).toBe(true);
    expect(showsAmount('solidFood', 'selfFed', 'grains')).toBe(true);
    expect(showsAmount('breastMilk', 'leftBreast', 'grains')).toBe(false);
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

  it('recognises a zero interval as a one-off (no repeat)', () => {
    expect(isNoRepeat(0)).toBe(true);
    expect(isNoRepeat(6)).toBe(false);
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
      // `grains` rather than the default `fruits`: fruit portions carry no
      // amount, so the amount assertion below would be testing nothing.
      draft: makeDraft({
        kind: 'solidFood',
        method: 'parentFed',
        solidFoodType: 'grains',
        amount: 40,
        note: 'oats',
      }),
    });
    const draft = entryToDraft(entry);
    expect(draft.kind).toBe('solidFood');
    expect(draft.method).toBe('parentFed');
    expect(draft.solidFoodType).toBe('grains');
    expect(draft.amount).toBe(40);
    expect(draft.note).toBe('oats');
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

describe('solid food type', () => {
  it('hides the amount for solids nobody weighs, shows it for the rest', () => {
    expect(showsAmount('solidFood', 'selfFed', 'fruits')).toBe(false);
    expect(showsAmount('solidFood', 'selfFed', 'vegetables')).toBe(false);
    expect(showsAmount('solidFood', 'selfFed', 'grains')).toBe(true);
    expect(showsAmount('solidFood', 'selfFed', 'protein')).toBe(true);
    expect(showsAmount('solidFood', 'selfFed', 'dairy')).toBe(true);
  });

  it('still shows the amount for a bottle whatever the solid type says', () => {
    // The solid type is a leftover from an earlier selection here — a flat
    // draft keeps it around, and it must not suppress the bottle's amount.
    expect(showsAmount('breastMilk', 'bottle', 'fruits')).toBe(true);
  });

  it('is recorded only on solid feeds', () => {
    const common = { childId: 'c1', id: 'e1', creator: 'Sarah', type: 'feeding' as const };
    const solid = draftToEntry({
      ...common,
      draft: makeDraft({ kind: 'solidFood', method: 'selfFed', solidFoodType: 'dairy' }),
    }) as FeedingEntry;
    expect(solid.solidFoodType).toBe('dairy');

    const bottle = draftToEntry({
      ...common,
      draft: makeDraft({ kind: 'formula', method: 'bottle', solidFoodType: 'dairy' }),
    }) as FeedingEntry;
    expect(bottle.solidFoodType).toBeUndefined();
  });
});

describe('feeding baselines', () => {
  it('captures the bottle quantity for bottles and the duration for the breast', () => {
    expect(baselinePatch('bottle', 150, 18)).toEqual({ defaultQtyAtEntry: 150 });
    expect(baselinePatch('leftBreast', 150, 18)).toEqual({ defaultTimeAtEntry: 18 });
    expect(baselinePatch('bothBreasts', 150, 18)).toEqual({ defaultTimeAtEntry: 18 });
  });

  it('captures nothing for solid-food methods', () => {
    expect(baselinePatch('selfFed', 150, 18)).toEqual({});
    expect(baselinePatch('parentFed', 150, 18)).toEqual({});
  });

  it('carries a null through rather than inventing a baseline', () => {
    // No breast history yet — the entry should record no baseline at all, so
    // the feed draws no gauge rather than a gauge against a made-up normal.
    expect(baselinePatch('rightBreast', 150, null)).toEqual({ defaultTimeAtEntry: null });
  });

  it('attaches each baseline only to the method it describes', () => {
    const common = { childId: 'c1', id: 'e1', creator: 'Sarah', type: 'feeding' as const };
    // Both are set in the draft (the user tried bottle, then switched).
    const draft = makeDraft({ defaultQtyAtEntry: 150, defaultTimeAtEntry: 18 });

    const breast = draftToEntry({
      ...common,
      draft: { ...draft, kind: 'breastMilk', method: 'leftBreast' },
    }) as FeedingEntry;
    expect(breast.defaultTimeAtEntry).toBe(18);
    expect(breast.defaultQtyAtEntry).toBeUndefined();

    const bottle = draftToEntry({
      ...common,
      draft: { ...draft, kind: 'formula', method: 'bottle' },
    }) as FeedingEntry;
    expect(bottle.defaultQtyAtEntry).toBe(150);
    expect(bottle.defaultTimeAtEntry).toBeUndefined();
  });

  it('keeps an edited entry on its original baseline', () => {
    const entry = draftToEntry({
      childId: 'c1',
      id: 'e1',
      creator: 'Sarah',
      type: 'feeding',
      draft: makeDraft({ kind: 'formula', method: 'bottle', defaultQtyAtEntry: 90 }),
    });
    // A later Settings change raised the default to 200; the old entry keeps 90.
    expect(entryToDraft(entry, 200).defaultQtyAtEntry).toBe(90);
  });
});

describe('diaper amount', () => {
  it('names the amount after whichever contents are present', () => {
    expect(diaperAmountLabel(true, true)).toBe('Amount');
    expect(diaperAmountLabel(false, true)).toBe('Poo amount');
    expect(diaperAmountLabel(true, false)).toBe('Pee amount');
  });

  it('round-trips through the entry', () => {
    const entry = draftToEntry({
      childId: 'c1',
      id: 'e1',
      creator: 'Sarah',
      type: 'diaper',
      draft: makeDraft({ diaperAmount: 8 }),
    }) as DiaperEntry;
    expect(entry.amount).toBe(8);
    expect(entryToDraft(entry).diaperAmount).toBe(8);
  });
});

describe('medication unit-dependent fields', () => {
  it('hides the dose for paste only', () => {
    expect(showsDose('ml')).toBe(true);
    expect(showsDose('tablets')).toBe(true);
    expect(showsDose('paste')).toBe(false);
  });

  it('shows route for tablets and body area for paste', () => {
    expect(showsRoute('tablets')).toBe(true);
    expect(showsRoute('ml')).toBe(false);
    expect(showsBodyArea('paste')).toBe(true);
    expect(showsBodyArea('tablets')).toBe(false);
  });

  it('shows the 24h limit for as-needed medication only', () => {
    expect(showsMaxDose('asNeeded')).toBe(true);
    expect(showsMaxDose('scheduled')).toBe(false);
  });

  it('saves route and body area only under the unit that reveals them', () => {
    const common = { childId: 'c1', id: 'e1', creator: 'Sarah', type: 'medication' as const };
    const draft = makeDraft({ medName: 'Tylenol', route: 'anal', bodyArea: 'left cheek' });

    const tablets = draftToEntry({
      ...common,
      draft: { ...draft, doseUnit: 'tablets' },
    }) as MedicationEntry;
    expect(tablets.route).toBe('anal');
    expect(tablets.bodyArea).toBeUndefined();

    const paste = draftToEntry({
      ...common,
      draft: { ...draft, doseUnit: 'paste' },
    }) as MedicationEntry;
    expect(paste.bodyArea).toBe('left cheek');
    expect(paste.route).toBeUndefined();

    const ml = draftToEntry({ ...common, draft: { ...draft, doseUnit: 'ml' } }) as MedicationEntry;
    expect(ml.route).toBeUndefined();
    expect(ml.bodyArea).toBeUndefined();
  });

  it('drops a whitespace-only body area', () => {
    const entry = draftToEntry({
      childId: 'c1',
      id: 'e1',
      creator: 'Sarah',
      type: 'medication',
      draft: makeDraft({ doseUnit: 'paste', bodyArea: '   ' }),
    }) as MedicationEntry;
    expect(entry.bodyArea).toBeUndefined();
  });
});

describe('medication 24h limit', () => {
  const common = { childId: 'c1', id: 'e1', creator: 'Sarah', type: 'medication' as const };

  it('records a stated limit on an as-needed dose', () => {
    const entry = draftToEntry({
      ...common,
      draft: makeDraft({ medName: 'Tylenol', schedule: 'asNeeded', maxDose24h: 20 }),
    }) as MedicationEntry;
    expect(entry.maxDose24h).toBe(20);
  });

  it('states no limit when the field is left blank, rather than clearing one', () => {
    // Resolved decision (DESIGN_REFRESH_PLAN §2 Batch B): an entry with no
    // stated limit is silent about the limit. `medLimitSummaries` resolves the
    // pair's limit from the newest entry that *states* one, so a blank field
    // carries the existing limit forward instead of dropping it.
    const entry = draftToEntry({
      ...common,
      draft: makeDraft({ medName: 'Tylenol', schedule: 'asNeeded', maxDose24h: null }),
    }) as MedicationEntry;
    expect(entry.maxDose24h).toBeUndefined();

    const earlier: MedicationEntry = {
      ...(draftToEntry({
        ...common,
        id: 'e0',
        draft: makeDraft({ medName: 'Tylenol', schedule: 'asNeeded', maxDose24h: 20 }),
      }) as MedicationEntry),
      time: new Date(NOW - 3 * 60 * 60 * 1000).toISOString(),
    };
    const summaries = medLimitSummaries([earlier, { ...entry, dose: 5 }], NOW);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].limit).toBe(20);
  });

  it('does not attach a limit to a scheduled dose', () => {
    const entry = draftToEntry({
      ...common,
      draft: makeDraft({ schedule: 'scheduled', maxDose24h: 20 }),
    }) as MedicationEntry;
    expect(entry.maxDose24h).toBeUndefined();
  });

  it('round-trips an existing limit into the edit form', () => {
    const entry = draftToEntry({
      ...common,
      draft: makeDraft({ medName: 'Tylenol', schedule: 'asNeeded', maxDose24h: 20 }),
    });
    expect(entryToDraft(entry).maxDose24h).toBe(20);
  });
});

describe('medSuggestionPatch', () => {
  function med(patch: Partial<MedicationEntry> = {}): MedicationEntry {
    return {
      id: 'medication:1',
      childId: 'c1',
      type: 'medication',
      time: new Date(NOW).toISOString(),
      tags: [],
      creator: 'Sarah',
      name: 'Tylenol',
      dose: 5,
      doseUnit: 'ml',
      schedule: 'asNeeded',
      repeatHours: 4,
      ...patch,
    };
  }

  it('carries the whole medicine forward, not just its name', () => {
    expect(
      medSuggestionPatch(
        med({ doseUnit: 'tablets', route: 'anal', maxDose24h: 6, repeatHours: 8 }),
      ),
    ).toEqual({
      medName: 'Tylenol',
      dose: 5,
      doseUnit: 'tablets',
      route: 'anal',
      bodyArea: '',
      schedule: 'asNeeded',
      repeatHours: 8,
      repeatCustom: false,
      maxDose24h: 6,
    });
  });

  it('carries the custom flag for an off-preset interval', () => {
    expect(medSuggestionPatch(med({ repeatHours: 6.5 })).repeatCustom).toBe(true);
    expect(medSuggestionPatch(med({ repeatHours: 8 })).repeatCustom).toBe(false);
    // A one-off dose is neither a preset nor custom.
    expect(medSuggestionPatch(med({ repeatHours: 0 })).repeatCustom).toBe(false);
  });

  it('falls back to the defaults for fields the suggestion does not carry', () => {
    const patch = medSuggestionPatch(med());
    expect(patch.route).toBe('orally');
    expect(patch.bodyArea).toBe('');
    expect(patch.maxDose24h).toBeNull();
  });
});

describe('sleep type', () => {
  it('guesses nap during the day and night after 7pm', () => {
    const at = (hour: number) => new Date(2026, 6, 19, hour, 0, 0).getTime();
    expect(defaultSleepType(at(9))).toBe('nap');
    expect(defaultSleepType(at(18))).toBe('nap');
    expect(defaultSleepType(at(19))).toBe('night');
    expect(defaultSleepType(at(3))).toBe('night');
    expect(defaultSleepType(at(6))).toBe('night');
    expect(defaultSleepType(at(7))).toBe('nap');
  });

  it('round-trips through the entry', () => {
    const entry = draftToEntry({
      childId: 'c1',
      id: 'e1',
      creator: 'Sarah',
      type: 'sleep',
      draft: makeDraft({ sleepType: 'nap' }),
    }) as SleepEntry;
    expect(entry.sleepType).toBe('nap');
    expect(entryToDraft(entry).sleepType).toBe('nap');
  });
});

describe('seedDraft', () => {
  // Build an entry of `type` from a draft patch, so tests describe the entry in
  // the same vocabulary the form uses.
  function entry(
    type: Entry['type'],
    patch: Partial<ReturnType<typeof emptyDraft>> = {},
  ): Entry {
    return draftToEntry({ childId: 'c1', id: `seed-${type}`, creator: 'Sarah', type, draft: makeDraft(patch) });
  }

  it('falls back to empty defaults when there is no prior entry of the type', () => {
    const d = seedDraft('diaper', [], NOW, 150);
    expect(d.pee).toBe(true);
    expect(d.poo).toBe(false);
    expect(d.amount).toBe(150);
  });

  it('carries the last feed of the type forward as the default', () => {
    const feed = entry('feeding', { kind: 'formula', method: 'bottle', amount: 95 });
    const d = seedDraft('feeding', [feed], NOW, 120);
    expect(d.kind).toBe('formula');
    expect(d.amount).toBe(95);
  });

  it('carries the last diaper contents forward', () => {
    const diaper = entry('diaper', { pee: false, poo: true, pooColor: 'green' });
    const d = seedDraft('diaper', [diaper], NOW);
    expect(d.pee).toBe(false);
    expect(d.poo).toBe(true);
    expect(d.pooColor).toBe('green');
  });

  it('resets the time, span, note and tags on the fresh entry', () => {
    const older = new Date(NOW - 3 * 60 * 60 * 1000).toISOString();
    const feed: Entry = {
      ...(entry('feeding', { kind: 'formula', method: 'bottle', amount: 95 }) as FeedingEntry),
      time: older,
      endTime: older,
      note: 'sleepy',
      tags: [{ label: 'by Sarah', author: true }, { label: 'nap' }],
    };
    const d = seedDraft('feeding', [feed], NOW);
    expect(d.time).toBe(new Date(NOW).toISOString());
    expect(d.endTime).toBeNull();
    expect(d.note).toBe('');
    expect(d.tags).toEqual([]);
  });

  it('picks the most recent entry of the type', () => {
    const old: Entry = {
      ...(entry('diaper', { poo: true, diaperAmount: 3 }) as DiaperEntry),
      id: 'd0',
      time: new Date(NOW - 5 * 3600_000).toISOString(),
    };
    const recent: Entry = {
      ...(entry('diaper', { poo: true, diaperAmount: 9 }) as DiaperEntry),
      id: 'd1',
      time: new Date(NOW - 1 * 3600_000).toISOString(),
    };
    expect(seedDraft('diaper', [old, recent], NOW).diaperAmount).toBe(9);
    expect(mostRecentOfType([old, recent], 'diaper')?.id).toBe('d1');
  });

  it('re-captures the bottle baseline against the current default, not the old entry', () => {
    // The old feed froze a 90ml baseline; a new feed today should gauge against
    // the current 200ml default instead.
    const feed: Entry = {
      ...(entry('feeding', { kind: 'formula', method: 'bottle', amount: 95 }) as FeedingEntry),
      defaultQtyAtEntry: 90,
    };
    expect(seedDraft('feeding', [feed], NOW, 200).defaultQtyAtEntry).toBe(200);
  });

  it('does not inherit a completed sleep as the new entry state', () => {
    const done = entry('sleep', { stillSleeping: false, sleepType: 'night' });
    const d = seedDraft('sleep', [done], NOW);
    expect(d.stillSleeping).toBe(true);
    expect(d.sleepType).toBe('night');
  });
});
