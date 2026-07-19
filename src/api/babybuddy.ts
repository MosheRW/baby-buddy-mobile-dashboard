/**
 * The real `DataSource`, backed by Baby Buddy's REST API.
 *
 * Baby Buddy has no combined timeline endpoint, so `getEntries` fans out across
 * the seven per-type endpoints in parallel and merges them into one internal
 * timeline. Each request is bounded by `PER_TYPE_LIMIT` — the dashboard only
 * ever shows recent activity, and the medication logic looks back 10 days.
 */
import { z } from 'zod';
import type { Child, Entry, EntryType, Session } from './types';
import {
  childSchema,
  diaperChangeSchema,
  feedingSchema,
  medicationSchema,
  noteSchema,
  paginated,
  sleepSchema,
  temperatureSchema,
  tummyTimeSchema,
} from './schemas';
import {
  ENDPOINT,
  denormalize,
  normalizeChild,
  normalizeDiaper,
  normalizeFeeding,
  normalizeMedication,
  normalizeNote,
  normalizeSleep,
  normalizeTemperature,
  normalizeTummyTime,
  parseEntryId,
} from './normalize';
import { ParseError, rawRequest, request } from './client';

/** How many of each entry type to pull for the timeline. */
export const PER_TYPE_LIMIT = 100;

export interface DataSource {
  getChildren(signal?: AbortSignal): Promise<Child[]>;
  getEntries(signal?: AbortSignal): Promise<Entry[]>;
  createEntry(entry: Entry): Promise<Entry>;
  updateEntry(entry: Entry): Promise<Entry>;
  deleteEntry(id: string): Promise<void>;
}

/**
 * One parser per entry type: validate a raw payload against that endpoint's
 * schema, then normalize it. Pairing the schema with its normalizer inside a
 * closure keeps the DTO type variable local — a `Record` of `[schema,
 * normalizer]` tuples would lose the correlation between the two halves.
 */
type EntryParser = (json: unknown) => Entry;

function parser<T>(schema: z.ZodType<T>, normalize: (dto: T) => Entry): EntryParser {
  return (json) => {
    const result = schema.safeParse(json);
    if (!result.success) throw new ParseError('entry', result.error.issues);
    return normalize(result.data);
  };
}

const PARSERS: Record<EntryType, EntryParser> = {
  diaper: parser(diaperChangeSchema, normalizeDiaper),
  feeding: parser(feedingSchema, normalizeFeeding),
  medication: parser(medicationSchema, normalizeMedication),
  temperature: parser(temperatureSchema, normalizeTemperature),
  tummyTime: parser(tummyTimeSchema, normalizeTummyTime),
  sleep: parser(sleepSchema, normalizeSleep),
  note: parser(noteSchema, normalizeNote),
};

const ENTRY_TYPES = Object.keys(PARSERS) as EntryType[];

/** List envelope with items left unparsed — each is validated by its parser. */
const rawPage = paginated(z.unknown());

export function createBabyBuddyDataSource(
  getSession: () => Session | null,
  getDefaultFoodMl: (childId: string) => number | undefined,
): DataSource {
  /** Session-bound request options; throws if called while signed out. */
  function auth() {
    const session = getSession();
    if (!session) throw new Error('Not signed in.');
    return { baseUrl: session.baseUrl, token: session.token };
  }

  async function fetchType(type: EntryType, signal?: AbortSignal): Promise<Entry[]> {
    const page = await request(rawPage, {
      ...auth(),
      path: `api/${ENDPOINT[type]}/`,
      query: { limit: PER_TYPE_LIMIT, ordering: '-id' },
      signal,
    });
    return page.results.map(PARSERS[type]);
  }

  return {
    async getChildren(signal) {
      const page = await request(paginated(childSchema), {
        ...auth(),
        path: 'api/children/',
        query: { limit: 50 },
        signal,
      });
      return page.results.map((dto) =>
        normalizeChild(dto, getDefaultFoodMl(String(dto.id)) ?? 120),
      );
    },

    async getEntries(signal) {
      // One endpoint failing (e.g. an older server without /api/medication/)
      // shouldn't blank the whole dashboard — drop that type and keep the rest.
      const results = await Promise.allSettled(ENTRY_TYPES.map((t) => fetchType(t, signal)));
      const entries = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length === results.length && results.length > 0) {
        // Everything failed — surface the first error rather than an empty feed.
        throw (failed[0] as PromiseRejectedResult).reason;
      }

      return entries.sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
    },

    async createEntry(entry) {
      const created = await rawRequest({
        ...auth(),
        path: `api/${ENDPOINT[entry.type]}/`,
        method: 'POST',
        body: denormalize(entry),
      });
      return PARSERS[entry.type](created);
    },

    async updateEntry(entry) {
      const parsed = parseEntryId(entry.id);
      if (!parsed) throw new Error(`Cannot update an entry with id "${entry.id}".`);
      const updated = await rawRequest({
        ...auth(),
        path: `api/${ENDPOINT[entry.type]}/${parsed.serverId}/`,
        method: 'PATCH',
        body: denormalize(entry),
      });
      return PARSERS[entry.type](updated);
    },

    async deleteEntry(id) {
      const parsed = parseEntryId(id);
      if (!parsed) throw new Error(`Cannot delete an entry with id "${id}".`);
      // 204 No Content — nothing to validate, so skip the schema layer.
      await rawRequest({
        ...auth(),
        path: `api/${ENDPOINT[parsed.type]}/${parsed.serverId}/`,
        method: 'DELETE',
      });
    },
  };
}
