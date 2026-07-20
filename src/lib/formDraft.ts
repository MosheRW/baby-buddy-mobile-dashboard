/**
 * Log-entry form draft: its shape, its per-type field-visibility rules, and the
 * pure conversions between a draft and a domain `Entry`.
 *
 * The draft is one flat record rather than a per-type union so that switching
 * the Type chip mid-edit keeps whatever the user already typed (matching the
 * prototype, where flipping Diaper → Feeding → Diaper doesn't lose the toggles).
 * Only the fields relevant to the saved type are read by `draftToEntry`.
 */
import type {
  DosageUnit,
  Entry,
  EntryType,
  FeedingKind,
  FeedingMethod,
  MedicationSchedule,
  PooColor,
  SleepType,
  Tag,
  TemperatureMethod,
} from '../api/types';

export interface FormDraft {
  /** ISO start time. */
  time: string;
  /** ISO end time for timed entries (feeding/sleep/tummy), null if none. */
  endTime: string | null;
  note: string;
  /** Free-text tags only — the "by {creator}" author tag is added on save. */
  tags: string[];

  // diaper
  pee: boolean;
  poo: boolean;
  pooColor: PooColor;

  // feeding
  kind: FeedingKind;
  method: FeedingMethod;
  /** ml for bottle feeds, g for solids. */
  amount: number;
  /** Minutes, for direct-breast feeds logged without a timer. */
  durationMinutes: number;

  // medication
  medName: string;
  dose: number;
  /** Server-side dosage unit; preserved on edit, not surfaced in the form. */
  doseUnit: DosageUnit;
  schedule: MedicationSchedule;
  repeatHours: number;

  // temperature
  temperature: number;
  tempMethod: TemperatureMethod;

  // tummy time
  tummyMinutes: number;

  // sleep
  stillSleeping: boolean;
  sleepType: SleepType;
}

/** Defaults for a brand-new entry. `defaultFoodMl` comes from settings per child. */
export function emptyDraft(now: number = Date.now(), defaultFoodMl = 120): FormDraft {
  return {
    time: new Date(now).toISOString(),
    endTime: null,
    note: '',
    tags: [],

    pee: true,
    poo: false,
    pooColor: 'yellow',

    kind: 'breastMilk',
    method: 'bottle',
    amount: defaultFoodMl,
    durationMinutes: 15,

    medName: '',
    dose: 1,
    doseUnit: 'mg',
    schedule: 'scheduled',
    repeatHours: 6,

    temperature: 37,
    tempMethod: 'oral',

    tummyMinutes: 10,

    stillSleeping: true,
    sleepType: 'night',
  };
}

// --- Field visibility rules -------------------------------------------------

/** Method options depend on the feeding kind (handoff §Feeding fields). */
export const FEEDING_METHODS: Record<FeedingKind, FeedingMethod[]> = {
  breastMilk: ['bottle', 'leftBreast', 'rightBreast', 'bothBreasts'],
  formula: ['bottle'],
  fortifiedBreastMilk: ['bottle'],
  solidFood: ['selfFed', 'parentFed'],
};

export function methodsForKind(kind: FeedingKind): FeedingMethod[] {
  return FEEDING_METHODS[kind];
}

/**
 * Keep the method valid when the kind changes — if the current method isn't
 * offered by the new kind, fall back to that kind's first option.
 */
export function methodForKindChange(kind: FeedingKind, current: FeedingMethod): FeedingMethod {
  const options = methodsForKind(kind);
  return options.includes(current) ? current : options[0];
}

export function isDirectBreast(method: FeedingMethod): boolean {
  return method === 'leftBreast' || method === 'rightBreast' || method === 'bothBreasts';
}

/** Amount stepper shows for bottle feeds and for solids. */
export function showsAmount(kind: FeedingKind, method: FeedingMethod): boolean {
  return method === 'bottle' || kind === 'solidFood';
}

/**
 * Duration stepper shows only for direct-breast methods and only while no timer
 * is running (with a timer, duration is derived from elapsed time instead).
 */
export function showsDuration(method: FeedingMethod, timerRunning: boolean): boolean {
  return isDirectBreast(method) && !timerRunning;
}

/** Unit suffix for the feeding amount. */
export function amountUnit(kind: FeedingKind): string {
  return kind === 'solidFood' ? ' g' : ' ml';
}

/** Preset repeat intervals; anything else is "Custom". */
export const REPEAT_HOURS = [2, 4, 6, 8, 12] as const;

export function isCustomRepeat(hours: number): boolean {
  return !(REPEAT_HOURS as readonly number[]).includes(hours);
}

/** The repeat-interval label depends on the schedule type. */
export function repeatLabel(schedule: MedicationSchedule): string {
  return schedule === 'scheduled' ? 'Repeat next dose in' : 'Eligible again after';
}

// --- Draft ⇄ Entry ----------------------------------------------------------

interface ToEntryParams {
  draft: FormDraft;
  type: EntryType;
  childId: string;
  id: string;
  creator: string;
}

function tagsFor(draft: FormDraft, creator: string): Tag[] {
  return [{ label: `by ${creator}`, author: true }, ...draft.tags.map((label) => ({ label }))];
}

/** Build the domain entry a draft represents, reading only the type's fields. */
export function draftToEntry({ draft, type, childId, id, creator }: ToEntryParams): Entry {
  const base = {
    id,
    childId,
    time: draft.time,
    note: draft.note.trim() || undefined,
    tags: tagsFor(draft, creator),
    creator,
  };

  switch (type) {
    case 'diaper':
      return {
        ...base,
        type: 'diaper',
        pee: draft.pee,
        poo: draft.poo,
        pooColor: draft.poo ? draft.pooColor : undefined,
      };

    case 'feeding': {
      const method = methodForKindChange(draft.kind, draft.method);
      return {
        ...base,
        type: 'feeding',
        endTime: draft.endTime ?? undefined,
        kind: draft.kind,
        method,
        amount: showsAmount(draft.kind, method) ? draft.amount : undefined,
        durationMinutes: isDirectBreast(method) ? draft.durationMinutes : undefined,
      };
    }

    case 'medication':
      return {
        ...base,
        type: 'medication',
        name: draft.medName.trim(),
        dose: draft.dose,
        doseUnit: draft.doseUnit,
        schedule: draft.schedule,
        repeatHours: draft.repeatHours,
      };

    case 'temperature':
      return {
        ...base,
        type: 'temperature',
        value: draft.temperature,
        method: draft.tempMethod,
      };

    case 'tummyTime':
      return {
        ...base,
        type: 'tummyTime',
        endTime: draft.endTime ?? undefined,
        durationMinutes: draft.tummyMinutes,
      };

    case 'sleep':
      return {
        ...base,
        type: 'sleep',
        endTime: draft.stillSleeping ? undefined : (draft.endTime ?? undefined),
        ongoing: draft.stillSleeping,
        sleepType: draft.sleepType,
      };

    case 'note':
      return { ...base, type: 'note' };
  }
}

/** Hydrate a draft from an existing entry (edit mode). */
export function entryToDraft(entry: Entry, defaultFoodMl?: number): FormDraft {
  const draft = emptyDraft(Date.parse(entry.time), defaultFoodMl);

  draft.time = entry.time;
  draft.endTime = entry.endTime ?? null;
  draft.note = entry.note ?? '';
  draft.tags = entry.tags.filter((t) => !t.author).map((t) => t.label);

  switch (entry.type) {
    case 'diaper':
      draft.pee = entry.pee;
      draft.poo = entry.poo;
      if (entry.pooColor) draft.pooColor = entry.pooColor;
      break;
    case 'feeding':
      draft.kind = entry.kind;
      draft.method = entry.method;
      if (entry.amount != null) draft.amount = entry.amount;
      if (entry.durationMinutes != null) draft.durationMinutes = entry.durationMinutes;
      break;
    case 'medication':
      draft.medName = entry.name;
      draft.dose = entry.dose;
      draft.doseUnit = entry.doseUnit;
      draft.schedule = entry.schedule;
      draft.repeatHours = entry.repeatHours;
      break;
    case 'temperature':
      draft.temperature = entry.value;
      draft.tempMethod = entry.method;
      break;
    case 'tummyTime':
      if (entry.durationMinutes != null) draft.tummyMinutes = entry.durationMinutes;
      break;
    case 'sleep':
      draft.stillSleeping = entry.ongoing ?? false;
      draft.sleepType = entry.sleepType;
      break;
    case 'note':
      break;
  }

  return draft;
}
