/**
 * Human-readable labels and tint selection for entries. Pure and shared between
 * the dashboard feed and the log-entry form.
 */
// Imported from `theme/tokens` rather than the `theme` barrel on purpose: the
// barrel re-exports `typography`, which pulls in @expo-google-fonts/expo-font
// and can't load under the plain-node test environment. `src/lib` is pure, so
// it should never reach for the font loader anyway.
import { tints, colors, pooSwatch } from '../theme/tokens';
import { durationLabel } from './dates';
import type {
  DosageUnit,
  Entry,
  EntryType,
  FeedingKind,
  FeedingMethod,
  TemperatureMethod,
} from '../api/types';

export const entryTypeLabel: Record<EntryType, string> = {
  diaper: 'Diaper',
  feeding: 'Feeding',
  medication: 'Medication',
  temperature: 'Temp',
  tummyTime: 'Tummy time',
  sleep: 'Sleep',
  note: 'Note',
};

export const feedingKindLabel: Record<FeedingKind, string> = {
  breastMilk: 'Breast Milk',
  formula: 'Formula',
  fortifiedBreastMilk: 'Fortified Breast Milk',
  solidFood: 'Solid Food',
};

export const feedingMethodLabel: Record<FeedingMethod, string> = {
  bottle: 'Bottle',
  leftBreast: 'Left Breast',
  rightBreast: 'Right Breast',
  bothBreasts: 'Both Breasts',
  selfFed: 'Self Fed',
  parentFed: 'Parent Fed',
};

export const temperatureMethodLabel: Record<TemperatureMethod, string> = {
  oral: 'Oral',
  ear: 'Ear',
  forehead: 'Forehead',
};

/** Background+foreground tint for an entry type's icon swatch / card. */
export function entryTint(type: EntryType): { bg: string; fg: string } {
  switch (type) {
    case 'diaper':
      return { bg: tints.pee.bg, fg: tints.pee.fg };
    case 'feeding':
      return { bg: tints.feeding.bg, fg: tints.feeding.fg };
    case 'medication':
      return { bg: tints.eligible.bg, fg: tints.eligible.fg };
    case 'sleep':
      return { bg: tints.sleep.bg, fg: colors.textSecondary };
    case 'tummyTime':
      return { bg: tints.tummy.bg, fg: colors.textSecondary };
    case 'temperature':
      return { bg: tints.overdue.bg, fg: tints.overdue.fg };
    case 'note':
    default:
      return { bg: colors.neutral, fg: colors.textSecondary };
  }
}

/** Short title line for a feed row / banner, e.g. "Formula · 120ml". */
export function entryTitle(entry: Entry): string {
  switch (entry.type) {
    case 'diaper': {
      if (entry.pee && entry.poo) return 'Wet + dirty diaper';
      if (entry.poo) return 'Dirty diaper';
      return 'Wet diaper';
    }
    case 'feeding': {
      const parts = [feedingKindLabel[entry.kind]];
      if (entry.amount != null) {
        parts.push(`${entry.amount}${entry.kind === 'solidFood' ? 'g' : 'ml'}`);
      }
      return parts.join(' · ');
    }
    case 'medication':
      return `${entry.name} · ${entry.dose}`;
    case 'temperature':
      return `${entry.value}° · ${temperatureMethodLabel[entry.method]}`;
    case 'tummyTime':
      return 'Tummy time';
    case 'sleep':
      return entry.ongoing ? 'Sleeping' : 'Sleep';
    case 'note':
      return 'Note';
  }
}

/**
 * "Xh Ym" duration for a feeding/sleep/tummy-time entry, when one is
 * available. Absent for entries with no end (an ongoing sleep) and for a
 * zero-length span (e.g. a bottle feed logged with no timer, where the server
 * fills in `end = start`) — nothing meaningful to show in either case.
 */
export function entryDurationLabel(entry: Entry): string | undefined {
  if (entry.type !== 'feeding' && entry.type !== 'sleep' && entry.type !== 'tummyTime') {
    return undefined;
  }
  if (!entry.endTime) return undefined;
  const minutes = Math.round(
    (new Date(entry.endTime).getTime() - new Date(entry.time).getTime()) / 60_000,
  );
  if (minutes < 1) return undefined;
  return durationLabel(entry.time, entry.endTime);
}

// --- Glyph + swatch selection (Phase 8, Batch C) ----------------------------

/**
 * Every distinct glyph an entry can show. A string union rather than a
 * component reference so the choice stays pure and testable — `components/
 * glyphs/entryGlyphs.tsx` maps each key to a drawing.
 */
export type GlyphKind =
  | 'diaperPee'
  | 'diaperPoo'
  | 'diaperBoth'
  | 'feedingBottle'
  | 'feedingBreast'
  | 'feedingSolid'
  | 'medMg'
  | 'medMl'
  | 'medTablets'
  | 'medDrops'
  | 'medPaste'
  | 'temperature'
  | 'tummyTime'
  | 'nap'
  | 'night'
  | 'note';

/** Which glyph an entry gets, down to its sub-type. */
export function entryGlyphKind(entry: Entry): GlyphKind {
  switch (entry.type) {
    case 'diaper':
      if (entry.pee && entry.poo) return 'diaperBoth';
      return entry.poo ? 'diaperPoo' : 'diaperPee';
    case 'feeding':
      if (entry.kind === 'solidFood') return 'feedingSolid';
      // Only an actual breast method reads as a breast feed; breast milk from
      // a bottle is still a bottle.
      return isDirectBreastMethod(entry.method) ? 'feedingBreast' : 'feedingBottle';
    case 'medication':
      return MED_GLYPH_BY_UNIT[entry.doseUnit];
    case 'temperature':
      return 'temperature';
    case 'tummyTime':
      return 'tummyTime';
    case 'sleep':
      return entry.sleepType === 'nap' ? 'nap' : 'night';
    case 'note':
      return 'note';
  }
}

/** The glyph for a dosage unit on its own, with no entry to read it from. */
export function medGlyphKind(unit: DosageUnit): GlyphKind {
  return MED_GLYPH_BY_UNIT[unit];
}

const MED_GLYPH_BY_UNIT: Record<DosageUnit, GlyphKind> = {
  mg: 'medMg',
  ml: 'medMl',
  tablets: 'medTablets',
  drops: 'medDrops',
  paste: 'medPaste',
};

function isDirectBreastMethod(method: FeedingMethod): boolean {
  return method === 'leftBreast' || method === 'rightBreast' || method === 'bothBreasts';
}

/**
 * A fever, in whichever unit the server is configured for.
 *
 * Baby Buddy stores a bare number and the API doesn't say which scale it's in,
 * so this infers it: no human body temperature is 45 in Celsius, and none is
 * 45 in Fahrenheit either (that would be hypothermic beyond survival), so the
 * midpoint separates the two ranges cleanly.
 */
export function isFever(value: number): boolean {
  const celsius = value > 45 ? (value - 32) / 1.8 : value;
  return celsius >= 38;
}

export interface EntryVisual {
  glyph: GlyphKind;
  /** Foreground colour for the glyph. */
  accent: string;
  /** Swatch background behind the glyph, also the feed row's left accent. */
  iconBg: string;
  /** Set for a dirty diaper that recorded a colour. */
  pooSwatchColor?: string;
  /** "7/10" when a diaper recorded an amount. */
  amountBadge?: string;
  /** Red when feverish, green otherwise. */
  tempDotColor?: string;
}

/**
 * Glyph, colours and the small per-type adornments for one entry.
 *
 * A dirty diaper overrides the usual blue with its recorded stool colour —
 * that reading is the point of the entry, so it drives the icon rather than
 * being tucked into a secondary swatch.
 */
export function entryVisual(entry: Entry): EntryVisual {
  const tint = entryTint(entry.type);
  const visual: EntryVisual = {
    glyph: entryGlyphKind(entry),
    accent: tint.fg,
    iconBg: tint.bg,
  };

  switch (entry.type) {
    case 'diaper':
      if (entry.poo) {
        visual.accent = entry.pooColor ? pooSwatch[entry.pooColor] : tints.poo.fg;
        visual.iconBg = tints.poo.bg;
        if (entry.pooColor) visual.pooSwatchColor = pooSwatch[entry.pooColor];
      }
      if (entry.amount != null) visual.amountBadge = `${entry.amount}/10`;
      break;
    case 'temperature':
      visual.tempDotColor = isFever(entry.value) ? colors.danger : FEVER_OK_COLOR;
      break;
    default:
      break;
  }

  return visual;
}

/** Green "within normal range" dot for temperature readings. */
const FEVER_OK_COLOR = '#4E8A5B';
