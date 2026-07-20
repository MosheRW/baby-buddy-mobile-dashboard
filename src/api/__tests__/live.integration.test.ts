/**
 * @jest-environment node
 *
 * Live end-to-end check against a real Baby Buddy server.
 *
 * SKIPPED BY DEFAULT. To run it, create `.env.local` (already gitignored) with:
 *
 *   BABYBUDDY_URL=https://your-server.example.com
 *   BABYBUDDY_TOKEN=<your API key from Baby Buddy → user settings>
 *
 * then `npm run test:live`. Credentials are read from that file and never
 * printed — failures report shapes and status codes, not secrets.
 *
 * This exercises the real client, schemas, and normalizers (not a mock), so it
 * is the thing that actually validates Phase 5. It writes a small number of
 * entries and deletes each one it creates; `afterAll` reports anything it could
 * not clean up so you can remove it by hand.
 */
import fs from 'fs';
import path from 'path';
import { createBabyBuddyDataSource } from '../babybuddy';
import { rawRequest, request, getClockSkewMs, serverNow } from '../client';
import {
  diaperChangeSchema,
  feedingSchema,
  medicationSchema,
  noteSchema,
  profileSchema,
  sleepSchema,
  temperatureSchema,
  tummyTimeSchema,
} from '../schemas';
import type { Entry, Session } from '../types';
import { reconcileTimers } from '../../lib/timers';

function loadEnvLocal(): Record<string, string> {
  const file = path.resolve(__dirname, '../../../.env.local');
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = { ...loadEnvLocal(), ...process.env } as Record<string, string | undefined>;
const BASE_URL = env.BABYBUDDY_URL;
const TOKEN = env.BABYBUDDY_TOKEN;
const configured = Boolean(BASE_URL && TOKEN);

const session: Session = {
  mode: 'babybuddy',
  baseUrl: BASE_URL ?? '',
  token: TOKEN ?? '',
  userName: 'integration-test',
};

const dataSource = createBabyBuddyDataSource(
  () => session,
  () => 120,
);

/** Entries created by this run, removed in afterAll if a test left one behind. */
const created = new Set<string>();

async function createTracked(entry: Entry): Promise<Entry> {
  const saved = await dataSource.createEntry(entry);
  created.add(saved.id);
  return saved;
}

async function deleteTracked(id: string): Promise<void> {
  await dataSource.deleteEntry(id);
  created.delete(id);
}

function baseEntry(childId: string) {
  return {
    id: '',
    childId,
    // serverNow, not Date.now — the server rejects times in its own future.
    time: new Date(serverNow()).toISOString(),
    tags: [{ label: 'by integration-test', author: true }],
    creator: 'integration-test',
  };
}

const describeLive = configured ? describe : describe.skip;

describeLive('live Baby Buddy server', () => {
  jest.setTimeout(60_000);

  let childId: string;

  afterAll(async () => {
    for (const id of created) {
      try {
        await dataSource.deleteEntry(id);
      } catch {
        console.warn(`LEFTOVER: could not delete ${id} — remove it manually.`);
      }
    }
  });

  it('authenticates and reports whether /api/profile exposes an api_key', async () => {
    const profile = await request(profileSchema, {
      baseUrl: session.baseUrl,
      path: 'api/profile',
      token: session.token,
    });
    expect(profile).toBeTruthy();
    // Answers plan question 2: does the password-login bootstrap have a key to read?
    console.log(
      `[profile] username present: ${Boolean(profile.username)}; ` +
        `api_key exposed: ${Boolean(profile.api_key)}`,
    );
    console.log(`[clock] server trails this device by ${-getClockSkewMs()}ms`);
  });

  it('lists children and normalizes them', async () => {
    const children = await dataSource.getChildren();
    console.log(`[children] ${children.length} found`);
    expect(children.length).toBeGreaterThan(0);

    const child = children[0];
    expect(child.id).toMatch(/^\d+$/);
    expect(child.name.length).toBeGreaterThan(0);
    expect(child.initial).toHaveLength(1);
    expect(child.hue).toBeGreaterThanOrEqual(0);
    expect(child.hue).toBeLessThan(360);
    expect(child.age).not.toBe('');
    childId = child.id;
  });

  it('reads the merged timeline across all seven endpoints', async () => {
    const entries = await dataSource.getEntries();
    const counts = entries.reduce<Record<string, number>>((acc, e) => {
      acc[e.type] = (acc[e.type] ?? 0) + 1;
      return acc;
    }, {});
    console.log('[entries] by type:', JSON.stringify(counts));

    // Every entry must have survived normalization with a usable shape.
    for (const e of entries) {
      expect(e.id).toMatch(/^[a-zA-Z]+:\d+$/);
      expect(Number.isFinite(Date.parse(e.time))).toBe(true);
      expect(e.childId).not.toBe('');
    }
    // Newest first.
    const times = entries.map((e) => Date.parse(e.time));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  /**
   * The timeline test above only proves the entries that *did* parse look sane.
   * A type whose rows all fail is silently dropped by the `Promise.allSettled`
   * fan-out, which is exactly how `color: ""` hid a broken diaper endpoint
   * behind a plausible-looking feed. This asserts per endpoint instead.
   */
  it.each([
    ['changes', diaperChangeSchema],
    ['feedings', feedingSchema],
    ['medication', medicationSchema],
    ['temperature', temperatureSchema],
    ['sleep', sleepSchema],
    ['tummy-times', tummyTimeSchema],
    ['notes', noteSchema],
  ])('parses every real row from /api/%s/', async (endpoint, schema) => {
    const page = (await rawRequest({
      baseUrl: session.baseUrl,
      token: session.token,
      path: `api/${endpoint}/`,
      query: { limit: 100 },
    })) as { count: number; results: unknown[] };

    const failures = page.results
      .map((row) => ({ row, result: schema.safeParse(row) }))
      .filter((r) => !r.result.success);

    if (failures.length > 0) {
      const { row, result } = failures[0];
      console.error(
        `[${endpoint}] ${failures.length}/${page.results.length} rows failed:`,
        JSON.stringify(result.error!.issues),
        '\nfirst offending row:',
        JSON.stringify(row),
      );
    }
    expect(failures).toHaveLength(0);
    console.log(`[${endpoint}] ${page.results.length} of ${page.count} rows parsed`);
  });

  it('round-trips a note: create → read back → edit → delete', async () => {
    const saved = await createTracked({
      ...baseEntry(childId),
      type: 'note',
      note: 'integration test — safe to delete',
    });
    expect(saved.id).toMatch(/^note:\d+$/);
    expect(saved.note).toBe('integration test — safe to delete');
    expect(saved.creator).toBe('integration-test');

    const afterCreate = await dataSource.getEntries();
    expect(afterCreate.some((e) => e.id === saved.id)).toBe(true);

    const edited = await dataSource.updateEntry({ ...saved, note: 'integration test — edited' });
    expect(edited.note).toBe('integration test — edited');

    await deleteTracked(saved.id);
    const afterDelete = await dataSource.getEntries();
    expect(afterDelete.some((e) => e.id === saved.id)).toBe(false);
  });

  it('round-trips a diaper with both booleans and a colour', async () => {
    const saved = await createTracked({
      ...baseEntry(childId),
      type: 'diaper',
      pee: true,
      poo: true,
      pooColor: 'green',
    });
    expect(saved).toMatchObject({ type: 'diaper', pee: true, poo: true, pooColor: 'green' });
    await deleteTracked(saved.id);
  });

  it('round-trips a medication, including the tag-encoded as-needed flag', async () => {
    const saved = await createTracked({
      ...baseEntry(childId),
      type: 'medication',
      name: 'IntegrationTest Placebo',
      dose: 2.5,
      doseUnit: 'ml',
      schedule: 'asNeeded',
      repeatHours: 6.5,
    });
    expect(saved).toMatchObject({
      type: 'medication',
      name: 'IntegrationTest Placebo',
      dose: 2.5,
      doseUnit: 'ml',
      schedule: 'asNeeded',
      repeatHours: 6.5,
    });
    // The encoded tag must not leak into the user-visible tag list.
    expect(saved.tags.map((t) => t.label)).not.toContain('as-needed');
    await deleteTracked(saved.id);
  });

  it('round-trips a temperature with its tag-encoded method', async () => {
    const saved = await createTracked({
      ...baseEntry(childId),
      type: 'temperature',
      value: 37.2,
      method: 'ear',
    });
    expect(saved).toMatchObject({ type: 'temperature', value: 37.2, method: 'ear' });
    expect(saved.tags.map((t) => t.label)).not.toContain('ear');
    await deleteTracked(saved.id);
  });

  it('round-trips a feeding, deriving duration from start/end', async () => {
    // Feeding enforces validate_unique_period, so a fixed window collides with
    // whatever the caregivers really logged. Walk back a day in hourly steps
    // until one is free — the point of the test is the duration round trip, not
    // the timestamp.
    const DURATION = 20;
    let saved: Entry | undefined;
    let lastError: unknown;

    for (let hoursBack = 1; hoursBack <= 24 && !saved; hoursBack += 1) {
      const start = serverNow() - hoursBack * 3_600_000;
      try {
        saved = await createTracked({
          ...baseEntry(childId),
          time: new Date(start).toISOString(),
          type: 'feeding',
          kind: 'breastMilk',
          method: 'leftBreast',
          durationMinutes: DURATION,
        });
      } catch (error) {
        if (!/intersects/i.test(String(error))) throw error;
        lastError = error;
      }
    }

    if (!saved) throw new Error(`No free 20-minute slot in the last 24h: ${String(lastError)}`);
    expect(saved).toMatchObject({ type: 'feeding', kind: 'breastMilk', method: 'leftBreast' });
    // Duration comes back derived server-side, not echoed from the request.
    expect(saved.type === 'feeding' && saved.durationMinutes).toBe(DURATION);
    await deleteTracked(saved.id);
  });

  describe('timers', () => {
    /** Server timer ids this block created, swept in afterEach. */
    const timers = new Set<number>();

    afterEach(async () => {
      for (const id of timers) {
        try {
          await dataSource.stopTimer(id);
        } catch {
          /* already stopped by the test */
        }
      }
      timers.clear();
    });

    it('starts a timer, lists it back, and stops it', async () => {
      const started = await dataSource.startTimer('sleep', childId, serverNow());
      timers.add(started.serverTimerId!);

      expect(started).toMatchObject({ type: 'sleep', childId });
      expect(started.serverTimerId).toEqual(expect.any(Number));

      const listed = await dataSource.getTimers();
      const found = listed.find((t) => t.serverTimerId === started.serverTimerId);
      expect(found).toMatchObject({ type: 'sleep', childId });
      // The start time survives the round trip to the second (the server
      // returns its own microsecond-precision timestamp).
      expect(Math.abs(found!.startedAt - started.startedAt)).toBeLessThan(1000);

      await dataSource.stopTimer(started.serverTimerId!);
      timers.delete(started.serverTimerId!);

      const after = await dataSource.getTimers();
      expect(after.some((t) => t.serverTimerId === started.serverTimerId)).toBe(false);
    });

    it('reconciles a server timer into an empty local store', async () => {
      const started = await dataSource.startTimer('tummyTime', childId, serverNow());
      timers.add(started.serverTimerId!);

      const server = await dataSource.getTimers();
      const merged = reconcileTimers([], server);
      expect(merged.some((t) => t.serverTimerId === started.serverTimerId)).toBe(true);

      // Stopped on the server → a local copy claiming that id must not survive.
      await dataSource.stopTimer(started.serverTimerId!);
      timers.delete(started.serverTimerId!);

      const afterStop = await dataSource.getTimers();
      expect(reconcileTimers(merged, afterStop)).toEqual([]);
    });

    it('ignores a timer it cannot attribute to a type', async () => {
      // What Baby Buddy's own web UI creates — not ours to adopt.
      const raw = (await rawRequest({
        baseUrl: session.baseUrl,
        token: session.token,
        path: 'api/timers/',
        method: 'POST',
        body: { child: Number(childId), name: 'Quick Timer' },
      })) as { id: number };
      timers.add(raw.id);

      const listed = await dataSource.getTimers();
      expect(listed.some((t) => t.serverTimerId === raw.id)).toBe(false);
    });
  });
});

if (!configured) {
  describe('live Baby Buddy server', () => {
    it.skip('skipped — set BABYBUDDY_URL and BABYBUDDY_TOKEN in .env.local', () => {});
  });
}
