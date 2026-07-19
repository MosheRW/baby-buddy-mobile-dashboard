/**
 * Human-readable labels and tint selection for entries. Pure and shared between
 * the dashboard feed and the log-entry form.
 */
import { tints, colors } from '../theme';
import type {
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
