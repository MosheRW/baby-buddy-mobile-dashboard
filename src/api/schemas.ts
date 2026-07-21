/**
 * Zod schemas for Baby Buddy's REST responses, transcribed from the server's
 * own `openapi-schema.yml` (`components.schemas`). These describe the *wire*
 * shapes only — `normalize.ts` converts them into the internal `Entry` union,
 * and no UI code ever sees a type from this file.
 *
 * Schemas are deliberately lenient about extra keys (zod strips unknown keys by
 * default) so a newer server adding fields doesn't break the client.
 */
import { z } from 'zod';

/** DRF's paginated list envelope. */
export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    count: z.number(),
    next: z.string().nullable().optional(),
    previous: z.string().nullable().optional(),
    results: z.array(item),
  });
}

const tags = z.array(z.string()).default([]);
const id = z.number();

/**
 * A Django choice field that allows blank comes back as `""`, not null — so a
 * pee-only diaper change has `color: ""`. Treating that as "absent" is the
 * difference between one row failing and the whole endpoint dropping out of the
 * merged timeline (each type is parsed as a unit).
 */
function blankable<T extends z.ZodTypeAny>(schema: T) {
  // preprocess, not transform: a transform's output type is always present, which
  // would make the key required (as `X | undefined`) on every DTO literal.
  return z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional());
}

export const childSchema = z.object({
  id,
  first_name: z.string(),
  last_name: z.string().default(''),
  birth_date: z.string(),
  birth_time: z.string().nullable().optional(),
  slug: z.string().default(''),
  picture: z.string().nullable().optional(),
});

export const diaperChangeSchema = z.object({
  id,
  child: z.number(),
  time: z.string(),
  wet: z.boolean(),
  solid: z.boolean(),
  color: blankable(z.enum(['black', 'brown', 'green', 'yellow'])),
  amount: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  tags,
});

export const feedingSchema = z.object({
  id,
  child: z.number().nullable(),
  start: z.string(),
  end: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
  type: z.enum(['breast milk', 'formula', 'fortified breast milk', 'solid food']),
  method: z.enum(['bottle', 'left breast', 'right breast', 'both breasts', 'parent fed', 'self fed']),
  amount: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  tags,
});

export const medicationSchema = z.object({
  id,
  child: z.number(),
  name: z.string(),
  dosage: z.number().nullable().optional(),
  dosage_unit: blankable(z.enum(['mg', 'ml', 'tablets', 'drops'])),
  time: z.string(),
  /** Django duration, "HH:MM:SS" or "D HH:MM:SS". */
  next_dose_interval: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  tags,
});

export const temperatureSchema = z.object({
  id,
  child: z.number(),
  temperature: z.number(),
  time: z.string(),
  notes: z.string().nullable().optional(),
  tags,
});

export const sleepSchema = z.object({
  id,
  child: z.number().nullable(),
  start: z.string(),
  end: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
  nap: z.boolean().nullable().optional(),
  notes: z.string().nullable().optional(),
  tags,
});

export const tummyTimeSchema = z.object({
  id,
  child: z.number().nullable(),
  start: z.string(),
  end: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
  /** TummyTime has no `notes` field — milestone is its only free text. */
  milestone: z.string().nullable().optional().default(''),
  tags,
});

export const noteSchema = z.object({
  id,
  child: z.number(),
  note: z.string(),
  time: z.string(),
  tags,
});

export const timerSchema = z.object({
  id,
  child: z.number().nullable().optional(),
  name: z.string().nullable().optional(),
  start: z.string(),
  duration: z.string().nullable().optional(),
  user: z.number().nullable().optional(),
});

/** `/api/profile` — shape is undocumented; only these keys are relied upon. */
export const profileResponseSchema = z.object({
  api_key: z.string().optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  user: z.object({
    email: z.email().optional(),
    first_name: z.string().optional(),
    id: z.number().optional(),
    is_staff: z.boolean().optional(),
    last_name: z.string().optional(),
    username: z.string().optional(),
  }).optional(),
});

/** `/api/profile` — shape is undocumented; only these keys are relied upon. */
export const profileSchema = z.object({
  username: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  api_key: z.string().optional(),
});

export type ChildDto = z.infer<typeof childSchema>;
export type DiaperChangeDto = z.infer<typeof diaperChangeSchema>;
export type FeedingDto = z.infer<typeof feedingSchema>;
export type MedicationDto = z.infer<typeof medicationSchema>;
export type TemperatureDto = z.infer<typeof temperatureSchema>;
export type SleepDto = z.infer<typeof sleepSchema>;
export type TummyTimeDto = z.infer<typeof tummyTimeSchema>;
export type NoteDto = z.infer<typeof noteSchema>;
export type TimerDto = z.infer<typeof timerSchema>;
export type ProfileDto = z.infer<typeof profileSchema>;
