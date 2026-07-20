import { entryGlyphKind, entryVisual, isFever } from '../entryDisplay';
import { pooSwatch, tints } from '../../theme/tokens';
import type { DiaperEntry, Entry, FeedingEntry, MedicationEntry } from '../../api/types';

const base = {
  id: 'e1',
  childId: 'c1',
  time: '2026-07-19T10:00:00Z',
  tags: [],
  creator: 'Sarah',
};

const diaper = (p: Partial<DiaperEntry>): DiaperEntry => ({
  ...base,
  type: 'diaper',
  pee: false,
  poo: false,
  ...p,
});

const feeding = (p: Partial<FeedingEntry>): FeedingEntry => ({
  ...base,
  type: 'feeding',
  kind: 'breastMilk',
  method: 'bottle',
  ...p,
});

const med = (p: Partial<MedicationEntry>): MedicationEntry => ({
  ...base,
  type: 'medication',
  name: 'Tylenol',
  dose: 5,
  doseUnit: 'mg',
  schedule: 'scheduled',
  repeatHours: 6,
  ...p,
});

describe('entryGlyphKind', () => {
  it('distinguishes the three diaper states', () => {
    expect(entryGlyphKind(diaper({ pee: true }))).toBe('diaperPee');
    expect(entryGlyphKind(diaper({ poo: true }))).toBe('diaperPoo');
    expect(entryGlyphKind(diaper({ pee: true, poo: true }))).toBe('diaperBoth');
  });

  it('treats breast milk from a bottle as a bottle, not a breast feed', () => {
    // The glyph follows the method, not the milk.
    expect(entryGlyphKind(feeding({ kind: 'breastMilk', method: 'bottle' }))).toBe(
      'feedingBottle',
    );
    expect(entryGlyphKind(feeding({ kind: 'breastMilk', method: 'leftBreast' }))).toBe(
      'feedingBreast',
    );
  });

  it('gives solid food its own glyph whatever the method', () => {
    expect(entryGlyphKind(feeding({ kind: 'solidFood', method: 'selfFed' }))).toBe(
      'feedingSolid',
    );
    expect(entryGlyphKind(feeding({ kind: 'solidFood', method: 'parentFed' }))).toBe(
      'feedingSolid',
    );
  });

  it('gives every dose unit a distinct glyph', () => {
    const kinds = (['mg', 'ml', 'tablets', 'drops', 'paste'] as const).map((doseUnit) =>
      entryGlyphKind(med({ doseUnit })),
    );
    expect(kinds).toEqual(['medMg', 'medMl', 'medTablets', 'medDrops', 'medPaste']);
    expect(new Set(kinds).size).toBe(5);
  });

  it('separates nap from night', () => {
    expect(entryGlyphKind({ ...base, type: 'sleep', sleepType: 'nap' } as Entry)).toBe('nap');
    expect(entryGlyphKind({ ...base, type: 'sleep', sleepType: 'night' } as Entry)).toBe(
      'night',
    );
  });
});

describe('isFever', () => {
  it('reads Celsius', () => {
    expect(isFever(37.2)).toBe(false);
    expect(isFever(38)).toBe(true);
  });

  it('infers Fahrenheit from the magnitude', () => {
    // 100.4F is 38C — the same threshold.
    expect(isFever(99)).toBe(false);
    expect(isFever(100.4)).toBe(true);
  });
});

describe('entryVisual', () => {
  it('lets a recorded stool colour drive the icon', () => {
    const v = entryVisual(diaper({ poo: true, pooColor: 'green' }));
    expect(v.accent).toBe(pooSwatch.green);
    expect(v.iconBg).toBe(tints.poo.bg);
    expect(v.pooSwatchColor).toBe(pooSwatch.green);
  });

  it('falls back to the amber poo tint when no colour was recorded', () => {
    const v = entryVisual(diaper({ poo: true }));
    expect(v.accent).toBe(tints.poo.fg);
    expect(v.pooSwatchColor).toBeUndefined();
  });

  it('keeps a wet-only diaper on the blue tint', () => {
    const v = entryVisual(diaper({ pee: true }));
    expect(v.iconBg).toBe(tints.pee.bg);
    expect(v.pooSwatchColor).toBeUndefined();
  });

  it('renders the amount badge only when an amount was recorded', () => {
    expect(entryVisual(diaper({ pee: true, amount: 7 })).amountBadge).toBe('7/10');
    expect(entryVisual(diaper({ pee: true })).amountBadge).toBeUndefined();
  });

  it('colours the temperature dot by fever', () => {
    expect(entryVisual({ ...base, type: 'temperature', value: 39, method: 'oral' }).tempDotColor)
      .not.toBe(
        entryVisual({ ...base, type: 'temperature', value: 36.8, method: 'oral' }).tempDotColor,
      );
  });

  it('gives every entry type a glyph and a swatch', () => {
    const all: Entry[] = [
      diaper({ pee: true }),
      feeding({}),
      med({}),
      { ...base, type: 'temperature', value: 37, method: 'oral' },
      { ...base, type: 'tummyTime' },
      { ...base, type: 'sleep', sleepType: 'night' },
      { ...base, type: 'note', note: 'hi' },
    ];
    for (const entry of all) {
      const v = entryVisual(entry);
      expect(v.glyph).toBeTruthy();
      expect(v.accent).toMatch(/^#/);
      expect(v.iconBg).toMatch(/^#/);
    }
  });
});
