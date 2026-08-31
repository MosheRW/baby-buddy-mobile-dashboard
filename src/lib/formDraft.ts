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
  MedicationEntry,
  MedicationRoute,
  MedicationSchedule,
  PooColor,
  SleepType,
  SolidFoodType,
  Tag,
  TemperatureMethod,
} from '../api/types';
import i18n from '../i18n';
import { defaultTimeForMethod } from './feed';

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
  /** 1–10 "how full", shown as an `x/10` badge in the feed. */
  diaperAmount: number;

  // feeding
  kind: FeedingKind;
  method: FeedingMethod;
  /** ml for bottle feeds, g for solids. */
  amount: number;
  /** Minutes, for direct-breast feeds logged without a timer. */
  durationMinutes: number;
  solidFoodType: SolidFoodType;
  /**
   * The "normal" amount/duration captured at the moment the method was picked,
   * so the feed's gauge compares against what was normal *then* — a later
   * Settings edit must not retroactively move an old entry's baseline.
   */
  defaultQtyAtEntry: number | null;
  defaultTimeAtEntry: number | null;

  // medication
  medName: string;
  dose: number;
  doseUnit: DosageUnit;
  /** Tablets only. */
  route: MedicationRoute;
  /** Paste only, free text. */
  bodyArea: string;
  /**
   * As-needed only. `null` means "don't state a limit on this entry" — which
   * is *not* the same as clearing one: the newest entry that states a limit
   * still governs the (name, child) pair. See `medLimitSummaries`.
   */
  maxDose24h: number | null;
  schedule: MedicationSchedule;
  /** Hours until the next dose; `0` means "don't repeat" (a one-off dose). */
  repeatHours: number;
  /**
   * Whether the repeat interval is a custom (off-preset) value. Tracked
   * explicitly rather than derived from `repeatHours` so the custom stepper can
   * land on a value that happens to coincide with a preset (e.g. 6h) without the
   * "Custom" chip snapping back and hiding the field.
   */
  repeatCustom: boolean;

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
    diaperAmount: 5,

    kind: 'breastMilk',
    method: 'bottle',
    amount: defaultFoodMl,
    durationMinutes: 15,
    solidFoodType: 'fruits',
    // A new draft opens on Bottle, so the bottle baseline is captured up front.
    defaultQtyAtEntry: defaultFoodMl,
    defaultTimeAtEntry: null,

    medName: '',
    dose: 5,
    doseUnit: 'ml',
    route: 'orally',
    bodyArea: '',
    maxDose24h: null,
    schedule: 'scheduled',
    repeatHours: 6,
    repeatCustom: false,

    temperature: 37,
    tempMethod: 'oral',

    tummyMinutes: 10,

    stillSleeping: true,
    sleepType: defaultSleepType(now),
  };
}

/**
 * Daytime sleep is a nap, night-time sleep isn't. Guessing from the clock beats
 * a fixed default: the toggle is one tap either way, but it's right most of the
 * time without one.
 */
export function defaultSleepType(now: number = Date.now()): SleepType {
  const hour = new Date(now).getHours();
  return hour >= 7 && hour < 19 ? 'nap' : 'night';
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

/** Solid-food types, in the prototype's chip order. */
export const SOLID_FOOD_TYPES: SolidFoodType[] = [
  'fruits',
  'vegetables',
  'grains',
  'protein',
  'dairy',
];

export function solidFoodTypeLabel(type: SolidFoodType): string {
  return i18n.t(`feeding.solid.${type}`);
}

/** Solids whose portion nobody weighs — the amount field is noise for them. */
const UNWEIGHED_SOLIDS: SolidFoodType[] = ['fruits', 'vegetables'];

/**
 * Amount stepper shows for bottle feeds, and for solids except the ones served
 * as whole pieces (a few grapes isn't a gram count anyone records).
 */
export function showsAmount(
  kind: FeedingKind,
  method: FeedingMethod,
  solidFoodType: SolidFoodType,
): boolean {
  if (method === 'bottle') return true;
  return kind === 'solidFood' && !UNWEIGHED_SOLIDS.includes(solidFoodType);
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
  return kind === 'solidFood'
    ? i18n.t('feeding.amountUnitSolid')
    : i18n.t('feeding.amountUnitLiquid');
}

/**
 * The baseline to stamp on the draft when a feeding method is picked. Bottle
 * feeds are measured against the child's usual amount, direct-breast feeds
 * against that side's recent average duration; other methods carry neither.
 *
 * Returned as a patch rather than applied in place because it has to happen at
 * the moment of selection — see `defaultQtyAtEntry`.
 */
export function baselinePatch(
  method: FeedingMethod,
  defaultFoodMl: number | null,
  defaultTimeMinutes: number | null,
): Partial<FormDraft> {
  if (method === 'bottle') return { defaultQtyAtEntry: defaultFoodMl };
  if (isDirectBreast(method)) return { defaultTimeAtEntry: defaultTimeMinutes };
  return {};
}

/** The diaper amount's label names whichever contents are actually present. */
export function diaperAmountLabel(pee: boolean, poo: boolean): string {
  if (pee && poo) return i18n.t('diaper.amountLabel.both');
  return poo ? i18n.t('diaper.amountLabel.poo') : i18n.t('diaper.amountLabel.pee');
}

/** Paste is measured by where it went, not how much — there's no dose to enter. */
export function showsDose(unit: DosageUnit): boolean {
  return unit !== 'paste';
}

/** Only tablets can go in one of two ends. */
export function showsRoute(unit: DosageUnit): boolean {
  return unit === 'tablets';
}

export function showsBodyArea(unit: DosageUnit): boolean {
  return unit === 'paste';
}

/**
 * A 24h ceiling only means something for as-needed medication — a scheduled
 * course's ceiling is the schedule.
 */
export function showsMaxDose(schedule: MedicationSchedule): boolean {
  return schedule === 'asNeeded';
}

/**
 * Prefill from a recent medication. Carries the whole shape forward, not just
 * the name — re-logging a dose of something already given is the common case,
 * and its unit/route/limit are part of "the same medicine".
 */
export function medSuggestionPatch(m: MedicationEntry): Partial<FormDraft> {
  return {
    medName: m.name,
    dose: m.dose,
    doseUnit: m.doseUnit,
    route: m.route ?? 'orally',
    bodyArea: m.bodyArea ?? '',
    schedule: m.schedule,
    repeatHours: m.repeatHours,
    repeatCustom: m.repeatHours > 0 && isCustomRepeat(m.repeatHours),
    maxDose24h: m.maxDose24h ?? null,
  };
}

/** Preset repeat intervals; anything else is "Custom". */
export const REPEAT_HOURS = [2, 4, 6, 8, 12] as const;

/** A one-off dose that isn't repeated is stored as a zero-hour interval. */
export function isNoRepeat(hours: number): boolean {
  return hours <= 0;
}

export function isCustomRepeat(hours: number): boolean {
  return !(REPEAT_HOURS as readonly number[]).includes(hours);
}

/** The repeat-interval label depends on the schedule type. */
export function repeatLabel(schedule: MedicationSchedule): string {
  return schedule === 'scheduled'
    ? i18n.t('med.repeatLabel.scheduled')
    : i18n.t('med.repeatLabel.asNeeded');
}

// --- Validation -------------------------------------------------------------

/**
 * Reason the draft can't be saved as `type` yet, or `undefined` when it's
 * valid. A diaper must record at least one of pee/poo — an empty diaper change
 * is a mis-tap, not a loggable event, and Baby Buddy's own form requires it too.
 */
export function draftSaveError(draft: FormDraft, type: EntryType): string | undefined {
  if (type === 'diaper' && !draft.pee && !draft.poo) {
    return i18n.t('diaper.selectOne');
  }
  return undefined;
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
        amount: draft.diaperAmount,
      };

    case 'feeding': {
      const method = methodForKindChange(draft.kind, draft.method);
      const solid = draft.kind === 'solidFood';
      return {
        ...base,
        type: 'feeding',
        endTime: draft.endTime ?? undefined,
        kind: draft.kind,
        method,
        amount: showsAmount(draft.kind, method, draft.solidFoodType) ? draft.amount : undefined,
        durationMinutes: isDirectBreast(method) ? draft.durationMinutes : undefined,
        solidFoodType: solid ? draft.solidFoodType : undefined,
        // Gate each baseline on the method it describes, so one left behind by
        // an earlier selection can't attach itself to a different method.
        defaultQtyAtEntry: method === 'bottle' ? (draft.defaultQtyAtEntry ?? undefined) : undefined,
        defaultTimeAtEntry: isDirectBreast(method)
          ? (draft.defaultTimeAtEntry ?? undefined)
          : undefined,
      };
    }

    case 'medication':
      return {
        ...base,
        type: 'medication',
        name: draft.medName.trim(),
        dose: draft.dose,
        doseUnit: draft.doseUnit,
        route: showsRoute(draft.doseUnit) ? draft.route : undefined,
        bodyArea: showsBodyArea(draft.doseUnit)
          ? draft.bodyArea.trim() || undefined
          : undefined,
        maxDose24h: showsMaxDose(draft.schedule) ? (draft.maxDose24h ?? undefined) : undefined,
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

/** The most recent entry of a given type, or undefined when there is none. */
export function mostRecentOfType(entries: Entry[], type: EntryType): Entry | undefined {
  let best: Entry | undefined;
  let bestAt = -Infinity;
  for (const e of entries) {
    if (e.type !== type) continue;
    const at = Date.parse(e.time);
    if (at > bestAt) {
      bestAt = at;
      best = e;
    }
  }
  return best;
}

/**
 * Defaults for a brand-new entry of `type`, carrying forward the *shape* of the
 * caregiver's most recent entry of that same type — the feed's kind/method/
 * amount, the medicine and its dose/schedule, the diaper's contents, the
 * temperature method, and so on. Re-logging almost always repeats last time's
 * choices, so this saves re-picking them every entry. Falls back to
 * `emptyDraft` when there's no prior entry of the type.
 *
 * `entries` should already be scoped to the child the form is for, so one
 * child's habits never seed another's.
 *
 * Only the "what" carries over; the "when" and the per-entry annotations don't —
 * time resets to now, any timed span is dropped, and note/tags start empty.
 */
export function seedDraft(
  type: EntryType,
  entries: Entry[],
  now: number = Date.now(),
  defaultFoodMl = 120,
): FormDraft {
  const base = emptyDraft(now, defaultFoodMl);
  const last = mostRecentOfType(entries, type);
  if (!last) return base;

  const seeded = entryToDraft(last, defaultFoodMl);
  seeded.time = base.time;
  seeded.endTime = null;
  seeded.note = '';
  seeded.tags = [];

  if (last.type === 'feeding') {
    // Re-capture the gauge baseline against today's settings/history rather than
    // freezing the prior entry's — a Settings change since then should count.
    Object.assign(
      seeded,
      baselinePatch(seeded.method, defaultFoodMl, defaultTimeForMethod(entries, seeded.method, now)),
    );
  }
  if (last.type === 'sleep') {
    // A fresh sleep entry defaults to "still sleeping"; don't inherit the prior
    // sleep's completed/ongoing state.
    seeded.stillSleeping = base.stillSleeping;
  }
  return seeded;
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
      if (entry.amount != null) draft.diaperAmount = entry.amount;
      break;
    case 'feeding':
      draft.kind = entry.kind;
      draft.method = entry.method;
      if (entry.amount != null) draft.amount = entry.amount;
      if (entry.durationMinutes != null) draft.durationMinutes = entry.durationMinutes;
      if (entry.solidFoodType) draft.solidFoodType = entry.solidFoodType;
      // Keep the original baselines rather than re-capturing today's — editing
      // a week-old feed must not re-scale its gauge to this week's normal.
      draft.defaultQtyAtEntry = entry.defaultQtyAtEntry ?? null;
      draft.defaultTimeAtEntry = entry.defaultTimeAtEntry ?? null;
      break;
    case 'medication':
      draft.medName = entry.name;
      draft.dose = entry.dose;
      draft.doseUnit = entry.doseUnit;
      if (entry.route) draft.route = entry.route;
      if (entry.bodyArea) draft.bodyArea = entry.bodyArea;
      draft.maxDose24h = entry.maxDose24h ?? null;
      draft.schedule = entry.schedule;
      draft.repeatHours = entry.repeatHours;
      draft.repeatCustom = entry.repeatHours > 0 && isCustomRepeat(entry.repeatHours);
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
