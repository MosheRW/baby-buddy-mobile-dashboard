/**
 * The one boundary where Baby Buddy's wire shapes become internal domain types.
 * Everything here is pure and unit-tested; `babybuddy.ts` does the I/O and
 * calls into this file, so no UI code ever sees a raw server payload.
 *
 * Three things the server model can't express directly, encoded as tags:
 *  - the "by {creator}" author tag (Baby Buddy doesn't record who created an
 *    entry on any endpoint except Timer),
 *  - a medication's scheduled/as-needed nature (`as-needed` tag present or not),
 *  - a temperature's measurement method (`oral` / `ear` / `forehead`).
 * `splitTags` strips these back out on read so they don't show up as ordinary
 * user tags in the form.
 */
import type {
  Child,
  DosageUnit,
  Entry,
  EntryType,
  FeedingKind,
  FeedingMethod,
  Tag,
  TemperatureMethod,
} from './types';
import type {
  ChildDto,
  DiaperChangeDto,
  FeedingDto,
  MedicationDto,
  NoteDto,
  SleepDto,
  TemperatureDto,
  TimerDto,
  TummyTimeDto,
} from './schemas';
import {
  TIMER_NAMES,
  timerTypeFromName,
  type RunningTimer,
  type TimerType,
} from '../lib/timers';

// --- Entry ids --------------------------------------------------------------
// Server ids are per-endpoint integers, so change #1 and feeding #1 both exist.
// Internal ids are namespaced to stay unique across the merged timeline.

export function entryId(type: EntryType, serverId: number): string {
  return `${type}:${serverId}`;
}

export function parseEntryId(id: string): { type: EntryType; serverId: number } | null {
  const idx = id.indexOf(':');
  if (idx < 0) return null;
  const type = id.slice(0, idx) as EntryType;
  const serverId = Number(id.slice(idx + 1));
  return Number.isFinite(serverId) ? { type, serverId } : null;
}

// --- Durations --------------------------------------------------------------

/** Parse a Django duration ("HH:MM:SS", "D HH:MM:SS", fractional seconds ok). */
export function parseDuration(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(?:(\d+)\s+)?(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(value.trim());
  if (!m) return null;
  const [, d, h, min, s] = m;
  return (
    (Number(d ?? 0) * 86400 + Number(h) * 3600 + Number(min) * 60 + Number(s)) * 1000
  );
}

/** Format hours as the "HH:MM:SS" Django expects for `next_dose_interval`. */
export function formatDuration(hours: number): string {
  const totalSeconds = Math.max(0, Math.round(hours * 3600));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// --- Tags -------------------------------------------------------------------

const AUTHOR_PREFIX = 'by ';
export const AS_NEEDED_TAG = 'as-needed';
const TEMP_METHOD_TAGS: TemperatureMethod[] = ['oral', 'ear', 'forehead'];

interface SplitTags {
  /** Internal tags: author first (if any), then free-text tags. */
  tags: Tag[];
  creator: string;
  asNeeded: boolean;
  tempMethod: TemperatureMethod | null;
}

/** Pull the encoded metadata out of a server tag list. */
export function splitTags(raw: string[]): SplitTags {
  let creator = '';
  let asNeeded = false;
  let tempMethod: TemperatureMethod | null = null;
  const free: string[] = [];

  for (const t of raw) {
    const lower = t.toLowerCase();
    if (t.startsWith(AUTHOR_PREFIX) && !creator) {
      creator = t.slice(AUTHOR_PREFIX.length);
    } else if (lower === AS_NEEDED_TAG) {
      asNeeded = true;
    } else if ((TEMP_METHOD_TAGS as string[]).includes(lower)) {
      tempMethod = lower as TemperatureMethod;
    } else {
      free.push(t);
    }
  }

  const tags: Tag[] = [
    ...(creator ? [{ label: `${AUTHOR_PREFIX}${creator}`, author: true }] : []),
    ...free.map((label) => ({ label })),
  ];
  return { tags, creator, asNeeded, tempMethod };
}

/** Rebuild the server tag list from internal tags plus encoded metadata. */
export function buildTags(tags: Tag[], extra: string[] = []): string[] {
  return [...tags.map((t) => t.label), ...extra];
}

// --- Child ------------------------------------------------------------------

/**
 * Deterministic per-child hue. Baby Buddy has no color field, so the avatar
 * tint is derived from the id by golden-angle spacing — stable across reloads
 * and well separated for small sibling counts.
 */
export function hueForChild(id: number): number {
  return Math.round((id * 137.508) % 360);
}

/** "7 months old" / "2 years old" / "12 days old". */
export function ageLabel(birthDate: string, now: number = Date.now()): string {
  const birth = new Date(birthDate);
  const ms = now - birth.getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';

  const days = Math.floor(ms / 86_400_000);
  if (days < 31) return `${days} ${days === 1 ? 'day' : 'days'} old`;

  const months =
    (new Date(now).getFullYear() - birth.getFullYear()) * 12 +
    (new Date(now).getMonth() - birth.getMonth()) -
    (new Date(now).getDate() < birth.getDate() ? 1 : 0);

  if (months < 24) return `${months} ${months === 1 ? 'month' : 'months'} old`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? 'year' : 'years'} old`;
}

export function normalizeChild(dto: ChildDto, defaultFoodMl = 120, now?: number): Child {
  const name = dto.first_name.trim();
  return {
    id: String(dto.id),
    name,
    initial: (name[0] ?? '?').toUpperCase(),
    hue: hueForChild(dto.id),
    age: ageLabel(dto.birth_date, now),
    defaultFoodMl,
  };
}

// --- Feeding enums ----------------------------------------------------------

const KIND_FROM: Record<FeedingDto['type'], FeedingKind> = {
  'breast milk': 'breastMilk',
  formula: 'formula',
  'fortified breast milk': 'fortifiedBreastMilk',
  'solid food': 'solidFood',
};
const KIND_TO: Record<FeedingKind, FeedingDto['type']> = {
  breastMilk: 'breast milk',
  formula: 'formula',
  fortifiedBreastMilk: 'fortified breast milk',
  solidFood: 'solid food',
};
const METHOD_FROM: Record<FeedingDto['method'], FeedingMethod> = {
  bottle: 'bottle',
  'left breast': 'leftBreast',
  'right breast': 'rightBreast',
  'both breasts': 'bothBreasts',
  'parent fed': 'parentFed',
  'self fed': 'selfFed',
};
const METHOD_TO: Record<FeedingMethod, FeedingDto['method']> = {
  bottle: 'bottle',
  leftBreast: 'left breast',
  rightBreast: 'right breast',
  bothBreasts: 'both breasts',
  parentFed: 'parent fed',
  selfFed: 'self fed',
};

// --- Wire → internal --------------------------------------------------------

export function normalizeDiaper(dto: DiaperChangeDto): Entry {
  const { tags, creator } = splitTags(dto.tags);
  return {
    id: entryId('diaper', dto.id),
    childId: String(dto.child),
    type: 'diaper',
    time: dto.time,
    note: dto.notes || undefined,
    tags,
    creator,
    pee: dto.wet,
    poo: dto.solid,
    pooColor: dto.solid ? (dto.color ?? undefined) : undefined,
  };
}

export function normalizeFeeding(dto: FeedingDto): Entry {
  const { tags, creator } = splitTags(dto.tags);
  const durationMs = parseDuration(dto.duration);
  return {
    id: entryId('feeding', dto.id),
    childId: String(dto.child ?? ''),
    type: 'feeding',
    time: dto.start,
    endTime: dto.end ?? undefined,
    note: dto.notes || undefined,
    tags,
    creator,
    kind: KIND_FROM[dto.type],
    method: METHOD_FROM[dto.method],
    amount: dto.amount ?? undefined,
    durationMinutes: durationMs != null ? Math.round(durationMs / 60_000) : undefined,
  };
}

export function normalizeMedication(dto: MedicationDto): Entry {
  const { tags, creator, asNeeded } = splitTags(dto.tags);
  const intervalMs = parseDuration(dto.next_dose_interval);
  return {
    id: entryId('medication', dto.id),
    childId: String(dto.child),
    type: 'medication',
    time: dto.time,
    note: dto.notes || undefined,
    tags,
    creator,
    name: dto.name,
    dose: dto.dosage ?? 0,
    doseUnit: (dto.dosage_unit ?? 'mg') as DosageUnit,
    schedule: asNeeded ? 'asNeeded' : 'scheduled',
    repeatHours: intervalMs != null ? intervalMs / 3_600_000 : 0,
  };
}

export function normalizeTemperature(dto: TemperatureDto): Entry {
  const { tags, creator, tempMethod } = splitTags(dto.tags);
  return {
    id: entryId('temperature', dto.id),
    childId: String(dto.child),
    type: 'temperature',
    time: dto.time,
    note: dto.notes || undefined,
    tags,
    creator,
    value: dto.temperature,
    method: tempMethod ?? 'oral',
  };
}

export function normalizeSleep(dto: SleepDto): Entry {
  const { tags, creator } = splitTags(dto.tags);
  return {
    id: entryId('sleep', dto.id),
    childId: String(dto.child ?? ''),
    type: 'sleep',
    time: dto.start,
    endTime: dto.end ?? undefined,
    note: dto.notes || undefined,
    tags,
    creator,
    // Baby Buddy has no "ongoing" flag; an unfinished sleep is one with no end.
    ongoing: !dto.end,
  };
}

export function normalizeTummyTime(dto: TummyTimeDto): Entry {
  const { tags, creator } = splitTags(dto.tags);
  const durationMs = parseDuration(dto.duration);
  return {
    id: entryId('tummyTime', dto.id),
    childId: String(dto.child ?? ''),
    type: 'tummyTime',
    time: dto.start,
    endTime: dto.end ?? undefined,
    // TummyTime has no notes field — milestone is its only free-text field.
    note: dto.milestone || undefined,
    tags,
    creator,
    durationMinutes: durationMs != null ? Math.round(durationMs / 60_000) : undefined,
  };
}

export function normalizeNote(dto: NoteDto): Entry {
  const { tags, creator } = splitTags(dto.tags);
  return {
    id: entryId('note', dto.id),
    childId: String(dto.child),
    type: 'note',
    time: dto.time,
    note: dto.note,
    tags,
    creator,
  };
}

/**
 * A server timer becomes a `RunningTimer` only if we can tell what it is for.
 * Baby Buddy timers carry no type and may have no child (its web UI can start a
 * generic one), so anything we can't classify is left alone rather than guessed
 * at — adopting a stranger's timer would attach it to the wrong entry on stop.
 */
export function normalizeTimer(dto: TimerDto): RunningTimer | null {
  const type = timerTypeFromName(dto.name);
  if (!type || dto.child == null) return null;

  const startedAt = Date.parse(dto.start);
  if (!Number.isFinite(startedAt)) return null;

  return { type, childId: String(dto.child), startedAt, serverTimerId: dto.id };
}

export function denormalizeTimer(
  type: TimerType,
  childId: string,
  startedAt: number,
): Record<string, unknown> {
  return {
    child: Number(childId),
    name: TIMER_NAMES[type],
    start: new Date(startedAt).toISOString(),
  };
}

// --- Internal → wire --------------------------------------------------------

/** The endpoint path segment each entry type is stored under. */
export const ENDPOINT: Record<EntryType, string> = {
  diaper: 'changes',
  feeding: 'feedings',
  medication: 'medication',
  temperature: 'temperature',
  tummyTime: 'tummy-times',
  sleep: 'sleep',
  note: 'notes',
};

/**
 * Resolve a timed entry's {start, end} from a start time plus a duration.
 *
 * Baby Buddy rejects any time in its own future (Sleep and TummyTime validate
 * both ends; Feeding validates the start), so "started now, lasted 20 minutes"
 * would always be refused. A caregiver logging a duration after the fact means
 * "a 20-minute feed that just ended", so when the window would run past `now` we
 * slide it back to end at `now` — preserving the duration the user entered
 * rather than truncating it.
 */
export function resolveWindow(
  start: string,
  durationMinutes: number | undefined,
  now: number,
  explicitEnd?: string,
): { start: string; end: string } {
  if (explicitEnd) return { start, end: explicitEnd };

  const startMs = Date.parse(start);
  if (durationMinutes == null) return { start, end: new Date(Math.min(startMs, now)).toISOString() };

  const durationMs = durationMinutes * 60_000;
  const endMs = startMs + durationMs;
  if (endMs <= now) return { start, end: new Date(endMs).toISOString() };

  return {
    start: new Date(now - durationMs).toISOString(),
    end: new Date(now).toISOString(),
  };
}

/**
 * Build the POST/PATCH body for an entry. `child` is the numeric server id.
 * Returns a plain record — the caller JSON-encodes it.
 *
 * `now` should be the server's clock (see `serverNow` in client.ts), not the
 * device's, so duration windows land on the past side of the server's now.
 */
export function denormalize(entry: Entry, now: number = Date.now()): Record<string, unknown> {
  const child = Number(entry.childId);

  switch (entry.type) {
    case 'diaper':
      return {
        child,
        time: entry.time,
        wet: entry.pee,
        solid: entry.poo,
        // Only send a color when there's solid content; the server rejects a
        // color on a wet-only change in some versions.
        ...(entry.poo && entry.pooColor ? { color: entry.pooColor } : {}),
        notes: entry.note ?? '',
        tags: buildTags(entry.tags),
      };

    case 'feeding': {
      // Duration is derived server-side from start/end, so a direct-breast feed
      // logged with a duration is sent as an end time.
      const { start, end } = resolveWindow(entry.time, entry.durationMinutes, now, entry.endTime);
      return {
        child,
        start,
        end,
        type: KIND_TO[entry.kind],
        method: METHOD_TO[entry.method],
        amount: entry.amount ?? null,
        notes: entry.note ?? '',
        tags: buildTags(entry.tags),
      };
    }

    case 'medication':
      return {
        child,
        name: entry.name,
        dosage: entry.dose,
        dosage_unit: entry.doseUnit,
        time: entry.time,
        next_dose_interval: formatDuration(entry.repeatHours),
        notes: entry.note ?? '',
        tags: buildTags(entry.tags, entry.schedule === 'asNeeded' ? [AS_NEEDED_TAG] : []),
      };

    case 'temperature':
      return {
        child,
        temperature: entry.value,
        time: entry.time,
        notes: entry.note ?? '',
        tags: buildTags(entry.tags, [entry.method]),
      };

    case 'sleep': {
      const body: Record<string, unknown> = {
        child,
        start: entry.time,
        notes: entry.note ?? '',
        tags: buildTags(entry.tags),
      };
      // An ongoing sleep is represented by omitting the end time.
      if (!entry.ongoing && entry.endTime) body.end = entry.endTime;
      return body;
    }

    case 'tummyTime': {
      const { start, end } = resolveWindow(entry.time, entry.durationMinutes, now, entry.endTime);
      return {
        child,
        start,
        end,
        milestone: entry.note ?? '',
        tags: buildTags(entry.tags),
      };
    }

    case 'note':
      return {
        child,
        note: entry.note ?? '',
        time: entry.time,
        tags: buildTags(entry.tags),
      };
  }
}
