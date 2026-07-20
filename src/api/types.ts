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
  /** Server-side `amount`, shown as an `x/10` badge in the feed. */
  amount?: number;
}

export type FeedingKind = 'breastMilk' | 'formula' | 'fortifiedBreastMilk' | 'solidFood';
export type FeedingMethod =
  | 'bottle'
  | 'leftBreast'
  | 'rightBreast'
  | 'bothBreasts'
  | 'selfFed'
  | 'parentFed';

/** Solid-food category. No server field — round-trips as `__foodtype`. */
export type SolidFoodType = 'fruits' | 'vegetables' | 'grains' | 'protein' | 'dairy';

export interface FeedingEntry extends EntryBase {
  type: 'feeding';
  kind: FeedingKind;
  method: FeedingMethod;
  /** ml for bottle, g for solid. */
  amount?: number;
  /** Minutes, for direct-breast feeds without a timer. */
  durationMinutes?: number;
  /** Only meaningful when `kind` is `solidFood`. */
  solidFoodType?: SolidFoodType;
  /**
   * The child's default bottle amount (ml) *at the moment this entry was
   * created* — deliberately frozen, so later Settings edits don't retroactively
   * move the baseline the feed's gauge bar compares against.
   */
  defaultQtyAtEntry?: number;
  /**
   * Same idea for direct-breast feeds: the child's 7-day average duration
   * (minutes) for this side at creation time. Note **minutes**, not seconds —
   * `CHANGES_SINCE_LAST_HANDOFF.md` says seconds, but the prototype divides
   * `durationMin` by it directly, so the prototype wins.
   */
  defaultTimeAtEntry?: number;
}

export type MedicationSchedule = 'scheduled' | 'asNeeded';

/** Baby Buddy's `dosage_unit` enum — exactly what the wire accepts. */
export type WireDosageUnit = 'mg' | 'ml' | 'tablets' | 'drops';

/**
 * What the unit picker offers. `paste` is the one unit with no server
 * representation, so it rides as `dosage_unit: 'ml'` + a `__unit:paste` tag.
 * The other four are the server's own enum and need no tag.
 */
export type DosageUnit = WireDosageUnit | 'paste';

/** Only meaningful for the `tablets` unit. No server field — `__route`. */
export type MedicationRoute = 'orally' | 'anal';

export interface MedicationEntry extends EntryBase {
  type: 'medication';
  name: string;
  dose: number;
  /** Drives the dose stepper's step/precision/label and the per-unit glyph. */
  doseUnit: DosageUnit;
  /** Tablets only. */
  route?: MedicationRoute;
  /** Paste only — free text, e.g. "left cheek". */
  bodyArea?: string;
  /**
   * Max total dose per 24h. Scoped to the **(medication name, child) pair**:
   * it rides on each entry, but readers resolve it as the value from the most
   * recent entry with this name *for this child*. A limit set on one child's
   * Tylenol must never surface on another child's.
   */
  maxDose24h?: number;
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

/** Drives the distinct nap vs. night glyphs. Server-side `sleep.nap`. */
export type SleepType = 'nap' | 'night';

export interface SleepEntry extends EntryBase {
  type: 'sleep';
  /** True while the timer is running / child is still asleep (no endTime yet). */
  ongoing?: boolean;
  /** `nap: true` on the wire; absent/false reads as `night`. */
  sleepType: SleepType;
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
