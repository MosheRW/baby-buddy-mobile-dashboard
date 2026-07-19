/**
 * Internal, backend-agnostic domain types. Both the direct Baby Buddy API and
 * the Home Assistant add-on API are normalized into these shapes at the
 * `src/api` boundary (Phase 5) — no UI code sees a raw server response.
 */

export type EntryType =
  | 'diaper'
  | 'feeding'
  | 'medication'
  | 'temperature'
  | 'tummyTime'
  | 'sleep'
  | 'note';

/** A tag on an entry. The first is always the auto "by {creator}" author tag. */
export interface Tag {
  label: string;
  /** True for the non-removable "by {creator}" author tag. */
  author?: boolean;
}

interface EntryBase {
  id: string;
  childId: string;
  type: EntryType;
  /** ISO 8601. For timed entries this is the start time. */
  time: string;
  /** ISO 8601 end time for timed entries (feeding/sleep/tummyTime). */
  endTime?: string;
  note?: string;
  tags: Tag[];
  /** Display name of who created the entry (drives the author tag). */
  creator: string;
}

// --- Per-type entry payloads ------------------------------------------------

/**
 * Baby Buddy's diaper `color` enum is exactly these four — the handoff's fifth
 * swatch (red) has no server representation, so it isn't offered.
 */
export type PooColor = 'yellow' | 'green' | 'brown' | 'black';

export interface DiaperEntry extends EntryBase {
  type: 'diaper';
  pee: boolean;
  poo: boolean;
  pooColor?: PooColor;
}

export type FeedingKind = 'breastMilk' | 'formula' | 'fortifiedBreastMilk' | 'solidFood';
export type FeedingMethod =
  | 'bottle'
  | 'leftBreast'
  | 'rightBreast'
  | 'bothBreasts'
  | 'selfFed'
  | 'parentFed';

export interface FeedingEntry extends EntryBase {
  type: 'feeding';
  kind: FeedingKind;
  method: FeedingMethod;
  /** ml for bottle, g for solid. */
  amount?: number;
  /** Minutes, for direct-breast feeds without a timer. */
  durationMinutes?: number;
}

export type MedicationSchedule = 'scheduled' | 'asNeeded';

/** Baby Buddy's `dosage_unit` enum. */
export type DosageUnit = 'mg' | 'ml' | 'tablets' | 'drops';

export interface MedicationEntry extends EntryBase {
  type: 'medication';
  name: string;
  dose: number;
  /**
   * Server-side `dosage_unit`. The form has no unit picker (the handoff's dose
   * stepper is unitless), so this is preserved on edit and defaults to mg on
   * create rather than silently rewriting an existing entry's unit.
   */
  doseUnit: DosageUnit;
  /**
   * Scheduled vs as-needed has no server field; it round-trips as an
   * "as-needed" tag (absent = scheduled). See api/normalize.ts.
   */
  schedule: MedicationSchedule;
  /** Hours until the next dose is due / eligible again (`next_dose_interval`). */
  repeatHours: number;
}

/** No server field — round-trips as a tag. See api/normalize.ts. */
export type TemperatureMethod = 'oral' | 'ear' | 'forehead';

export interface TemperatureEntry extends EntryBase {
  type: 'temperature';
  value: number;
  method: TemperatureMethod;
}

export interface TummyTimeEntry extends EntryBase {
  type: 'tummyTime';
  durationMinutes?: number;
}

export interface SleepEntry extends EntryBase {
  type: 'sleep';
  /** True while the timer is running / child is still asleep (no endTime yet). */
  ongoing?: boolean;
}

export interface NoteEntry extends EntryBase {
  type: 'note';
}

export type Entry =
  | DiaperEntry
  | FeedingEntry
  | MedicationEntry
  | TemperatureEntry
  | TummyTimeEntry
  | SleepEntry
  | NoteEntry;

// --- Child ------------------------------------------------------------------

export interface Child {
  id: string;
  name: string;
  /** Single-letter avatar initial. */
  initial: string;
  /** Hue (0–360) used to tint the avatar and cards. */
  hue: number;
  /** Human-readable age, e.g. "7 months old". */
  age: string;
  /** Default feeding amount (ml) prefilled in the log form. */
  defaultFoodMl: number;
}

// --- Session ----------------------------------------------------------------

export type LoginMode = 'babybuddy' | 'homeassistant';

export interface Session {
  mode: LoginMode;
  /**
   * Base URL of the Baby Buddy server. For the Home Assistant add-on this
   * includes the ingress path segment, e.g.
   * `http://homeassistant.local:8123/<addon-slug>`.
   */
  baseUrl: string;
  /** Display name of the signed-in user (drives the author tag). */
  userName: string;
  /**
   * Baby Buddy API key, sent as `Authorization: Token …`. Obtained either by
   * pasting it from the User Settings page or by bootstrapping a web session
   * with username/password and reading it off `/api/profile`.
   */
  token: string;
}
