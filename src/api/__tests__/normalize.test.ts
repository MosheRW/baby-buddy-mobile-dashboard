import type { MedicationEntry, TemperatureEntry } from '../types';
import { diaperChangeSchema, medicationSchema } from '../schemas';
import {
  AS_NEEDED_TAG,
  ageLabel,
  buildTags,
  denormalize,
  entryId,
  formatDuration,
  hueForChild,
  normalizeChild,
  normalizeDiaper,
  normalizeFeeding,
  normalizeMedication,
  normalizeSleep,
  normalizeTemperature,
  normalizeTummyTime,
  denormalizeTimer,
  normalizeTimer,
  parseDuration,
  parseEntryId,
  resolveWindow,
  splitTags,
} from '../normalize';

describe('entry ids', () => {
  it('namespaces per-endpoint ids so they stay unique in a merged timeline', () => {
    // Both endpoints have an id 1; the internal ids must differ.
    expect(entryId('diaper', 1)).not.toBe(entryId('feeding', 1));
  });

  it('round-trips', () => {
    expect(parseEntryId(entryId('tummyTime', 42))).toEqual({ type: 'tummyTime', serverId: 42 });
  });

  it('returns null for a malformed id', () => {
    expect(parseEntryId('nonsense')).toBeNull();
    expect(parseEntryId('diaper:abc')).toBeNull();
  });
});

describe('durations', () => {
  it('parses Django HH:MM:SS', () => {
    expect(parseDuration('01:30:00')).toBe(90 * 60_000);
  });

  it('parses the day-prefixed form', () => {
    expect(parseDuration('1 00:00:00')).toBe(86_400_000);
  });

  it('parses fractional seconds', () => {
    expect(parseDuration('00:00:01.500')).toBe(1500);
  });

  it('returns null for empty or malformed input', () => {
    expect(parseDuration(null)).toBeNull();
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('90 minutes')).toBeNull();
  });

  it('formats hours back to HH:MM:SS', () => {
    expect(formatDuration(6)).toBe('06:00:00');
    expect(formatDuration(0.5)).toBe('00:30:00');
    expect(formatDuration(12.25)).toBe('12:15:00');
  });

  it('round-trips a fractional custom repeat interval', () => {
    expect(parseDuration(formatDuration(6.5))).toBe(6.5 * 3_600_000);
  });
});

describe('tag encoding', () => {
  it('extracts the author tag and keeps free-text tags', () => {
    const s = splitTags(['by Sarah', 'daycare']);
    expect(s.creator).toBe('Sarah');
    expect(s.tags).toEqual([{ label: 'by Sarah', author: true }, { label: 'daycare' }]);
  });

  it('strips the as-needed marker so it is not shown as a user tag', () => {
    const s = splitTags(['by Sarah', AS_NEEDED_TAG, 'travel']);
    expect(s.asNeeded).toBe(true);
    expect(s.tags.map((t) => t.label)).toEqual(['by Sarah', 'travel']);
  });

  it('strips a temperature method tag', () => {
    const s = splitTags(['ear', 'fever']);
    expect(s.tempMethod).toBe('ear');
    expect(s.tags.map((t) => t.label)).toEqual(['fever']);
  });

  it('handles an entry with no tags at all', () => {
    const s = splitTags([]);
    expect(s.creator).toBe('');
    expect(s.tags).toEqual([]);
    expect(s.asNeeded).toBe(false);
    expect(s.tempMethod).toBeNull();
  });
});

describe('child', () => {
  const dto = { id: 3, first_name: 'Emma', last_name: 'W', birth_date: '2026-01-19', slug: 'emma' };

  it('derives a stable hue from the id', () => {
    expect(hueForChild(3)).toBe(hueForChild(3));
    expect(hueForChild(1)).not.toBe(hueForChild(2));
    expect(hueForChild(7)).toBeGreaterThanOrEqual(0);
    expect(hueForChild(7)).toBeLessThan(360);
  });

  it('maps to the internal child shape', () => {
    const child = normalizeChild(dto, 150, Date.parse('2026-07-19T12:00:00Z'));
    expect(child.id).toBe('3');
    expect(child.name).toBe('Emma');
    expect(child.initial).toBe('E');
    expect(child.defaultFoodMl).toBe(150);
  });

  it('labels age in days, months, then years', () => {
    const now = Date.parse('2026-07-19T12:00:00Z');
    expect(ageLabel('2026-07-07', now)).toBe('12 days old');
    expect(ageLabel('2025-12-19', now)).toBe('7 months old');
    expect(ageLabel('2024-07-19', now)).toBe('2 years old');
  });

  it('singularises a one-day-old', () => {
    expect(ageLabel('2026-07-18', Date.parse('2026-07-19T12:00:00Z'))).toBe('1 day old');
  });
});

describe('wire → internal', () => {
  const base = { tags: ['by Sarah'] };

  it('maps wet/solid to the independent pee/poo booleans', () => {
    const e = normalizeDiaper({
      ...base,
      id: 1,
      child: 2,
      time: '2026-07-19T10:00:00Z',
      wet: true,
      solid: true,
      color: 'green',
    });
    expect(e).toMatchObject({ type: 'diaper', pee: true, poo: true, pooColor: 'green' });
    expect(e.childId).toBe('2');
  });

  it('drops the color on a wet-only change', () => {
    const e = normalizeDiaper({
      ...base,
      id: 1,
      child: 2,
      time: '2026-07-19T10:00:00Z',
      wet: true,
      solid: false,
      color: 'yellow',
    });
    expect(e).toMatchObject({ poo: false, pooColor: undefined });
  });

  it('maps the feeding enums and derives duration from the server duration', () => {
    const e = normalizeFeeding({
      ...base,
      id: 5,
      child: 2,
      start: '2026-07-19T10:00:00Z',
      end: '2026-07-19T10:20:00Z',
      duration: '00:20:00',
      type: 'fortified breast milk',
      method: 'both breasts',
      amount: null,
    });
    expect(e).toMatchObject({
      kind: 'fortifiedBreastMilk',
      method: 'bothBreasts',
      durationMinutes: 20,
    });
  });

  it('reads the as-needed tag as the medication schedule', () => {
    const e = normalizeMedication({
      id: 7,
      child: 2,
      name: 'Tylenol',
      dosage: 2.5,
      dosage_unit: 'ml',
      time: '2026-07-19T10:00:00Z',
      next_dose_interval: '06:00:00',
      tags: ['by Sarah', AS_NEEDED_TAG],
    }) as MedicationEntry;
    expect(e.schedule).toBe('asNeeded');
    expect(e.repeatHours).toBe(6);
    expect(e.doseUnit).toBe('ml');
    expect(e.dose).toBe(2.5);
  });

  it('defaults a medication with no interval or unit', () => {
    const e = normalizeMedication({
      id: 7,
      child: 2,
      name: 'Vitamin D',
      time: '2026-07-19T10:00:00Z',
      tags: [],
    }) as MedicationEntry;
    expect(e.schedule).toBe('scheduled');
    expect(e.repeatHours).toBe(0);
    expect(e.doseUnit).toBe('mg');
  });

  it('reads the temperature method from its tag, defaulting to oral', () => {
    const withTag = normalizeTemperature({
      id: 8,
      child: 2,
      temperature: 37.2,
      time: '2026-07-19T10:00:00Z',
      tags: ['forehead'],
    }) as TemperatureEntry;
    expect(withTag.method).toBe('forehead');

    const without = normalizeTemperature({
      id: 9,
      child: 2,
      temperature: 37.2,
      time: '2026-07-19T10:00:00Z',
      tags: [],
    }) as TemperatureEntry;
    expect(without.method).toBe('oral');
  });

  it('treats a sleep with no end as ongoing', () => {
    const ongoing = normalizeSleep({
      ...base,
      id: 10,
      child: 2,
      start: '2026-07-19T10:00:00Z',
    });
    expect(ongoing).toMatchObject({ ongoing: true, endTime: undefined });

    const finished = normalizeSleep({
      ...base,
      id: 11,
      child: 2,
      start: '2026-07-19T10:00:00Z',
      end: '2026-07-19T11:00:00Z',
    });
    expect(finished).toMatchObject({ ongoing: false });
  });

  it('reads a tummy-time milestone as the note', () => {
    const e = normalizeTummyTime({
      ...base,
      id: 12,
      child: 2,
      start: '2026-07-19T10:00:00Z',
      end: '2026-07-19T10:10:00Z',
      duration: '00:10:00',
      milestone: 'rolled over',
    });
    expect(e.note).toBe('rolled over');
    expect(e).toMatchObject({ durationMinutes: 10 });
  });
});

describe('internal → wire', () => {
  const tags = [{ label: 'by Sarah', author: true }, { label: 'daycare' }];

  it('sends wet/solid and omits color when there is no solid', () => {
    const body = denormalize({
      id: 'diaper:1',
      childId: '2',
      type: 'diaper',
      time: '2026-07-19T10:00:00Z',
      tags,
      creator: 'Sarah',
      pee: true,
      poo: false,
      pooColor: 'green',
    });
    expect(body).toMatchObject({ child: 2, wet: true, solid: false });
    expect(body).not.toHaveProperty('color');
    expect(body.tags).toEqual(['by Sarah', 'daycare']);
  });

  it('converts a direct-breast duration into an end time', () => {
    const body = denormalize({
      id: 'feeding:1',
      childId: '2',
      type: 'feeding',
      time: '2026-07-19T10:00:00.000Z',
      tags,
      creator: 'Sarah',
      kind: 'breastMilk',
      method: 'leftBreast',
      durationMinutes: 20,
    });
    expect(body).toMatchObject({
      start: '2026-07-19T10:00:00.000Z',
      end: '2026-07-19T10:20:00.000Z',
      type: 'breast milk',
      method: 'left breast',
    });
  });

  it('appends the as-needed tag only for as-needed medication', () => {
    const prn = denormalize({
      id: 'medication:1',
      childId: '2',
      type: 'medication',
      time: '2026-07-19T10:00:00Z',
      tags,
      creator: 'Sarah',
      name: 'Tylenol',
      dose: 2.5,
      doseUnit: 'ml',
      schedule: 'asNeeded',
      repeatHours: 6,
    });
    expect(prn.tags).toContain(AS_NEEDED_TAG);
    expect(prn).toMatchObject({ dosage: 2.5, dosage_unit: 'ml', next_dose_interval: '06:00:00' });

    const scheduled = denormalize({
      id: 'medication:2',
      childId: '2',
      type: 'medication',
      time: '2026-07-19T10:00:00Z',
      tags,
      creator: 'Sarah',
      name: 'Amoxicillin',
      dose: 5,
      doseUnit: 'mg',
      schedule: 'scheduled',
      repeatHours: 8,
    });
    expect(scheduled.tags).not.toContain(AS_NEEDED_TAG);
  });

  it('encodes the temperature method as a tag', () => {
    const body = denormalize({
      id: 'temperature:1',
      childId: '2',
      type: 'temperature',
      time: '2026-07-19T10:00:00Z',
      tags,
      creator: 'Sarah',
      value: 37.2,
      method: 'ear',
    });
    expect(body.tags).toEqual(['by Sarah', 'daycare', 'ear']);
  });

  it('omits end for an ongoing sleep and sends it once ended', () => {
    const ongoing = denormalize({
      id: 'sleep:1',
      childId: '2',
      type: 'sleep',
      time: '2026-07-19T10:00:00Z',
      endTime: '2026-07-19T11:00:00Z',
      tags,
      creator: 'Sarah',
      ongoing: true,
      sleepType: 'night',
    });
    expect(ongoing).not.toHaveProperty('end');

    const ended = denormalize({
      id: 'sleep:2',
      childId: '2',
      type: 'sleep',
      time: '2026-07-19T10:00:00Z',
      endTime: '2026-07-19T11:00:00Z',
      tags,
      creator: 'Sarah',
      sleepType: 'night',
      ongoing: false,
    });
    expect(ended).toMatchObject({ end: '2026-07-19T11:00:00Z' });
  });

  it('sends a tummy-time note as milestone, since the endpoint has no notes field', () => {
    const body = denormalize({
      id: 'tummyTime:1',
      childId: '2',
      type: 'tummyTime',
      time: '2026-07-19T10:00:00.000Z',
      tags,
      creator: 'Sarah',
      note: 'rolled over',
      durationMinutes: 10,
    });
    expect(body).toMatchObject({ milestone: 'rolled over', end: '2026-07-19T10:10:00.000Z' });
    expect(body).not.toHaveProperty('notes');
  });
});

describe('resolveWindow (server rejects times in its own future)', () => {
  const NOW = Date.parse('2026-07-19T12:00:00.000Z');

  it('keeps a window that already ended in the past', () => {
    const w = resolveWindow('2026-07-19T11:00:00.000Z', 20, NOW);
    expect(w).toEqual({
      start: '2026-07-19T11:00:00.000Z',
      end: '2026-07-19T11:20:00.000Z',
    });
  });

  it('slides a "now + duration" window back so it ends at now', () => {
    // "A 20-minute feed logged right now" must not claim to end 20 minutes hence.
    const w = resolveWindow('2026-07-19T12:00:00.000Z', 20, NOW);
    expect(w).toEqual({
      start: '2026-07-19T11:40:00.000Z',
      end: '2026-07-19T12:00:00.000Z',
    });
  });

  it('preserves the entered duration when sliding', () => {
    const w = resolveWindow('2026-07-19T12:00:00.000Z', 45, NOW);
    expect(Date.parse(w.end) - Date.parse(w.start)).toBe(45 * 60_000);
  });

  it('honours an explicit end time over the duration', () => {
    const w = resolveWindow('2026-07-19T10:00:00.000Z', 20, NOW, '2026-07-19T10:05:00.000Z');
    expect(w.end).toBe('2026-07-19T10:05:00.000Z');
  });

  it('never returns an end in the future when there is no duration', () => {
    const w = resolveWindow('2026-07-19T18:00:00.000Z', undefined, NOW);
    expect(Date.parse(w.end)).toBeLessThanOrEqual(NOW);
  });
});

describe('denormalize timing', () => {
  const NOW = Date.parse('2026-07-19T12:00:00.000Z');

  it('does not send a tummy-time end in the future', () => {
    const body = denormalize(
      {
        id: 'tummyTime:1',
        childId: '2',
        type: 'tummyTime',
        time: '2026-07-19T12:00:00.000Z',
        tags: [],
        creator: 'Sarah',
        durationMinutes: 10,
      },
      NOW,
    );
    expect(Date.parse(body.end as string)).toBeLessThanOrEqual(NOW);
    expect(body.start).toBe('2026-07-19T11:50:00.000Z');
  });

  it('does not send a feeding end in the future', () => {
    const body = denormalize(
      {
        id: 'feeding:1',
        childId: '2',
        type: 'feeding',
        time: '2026-07-19T12:00:00.000Z',
        tags: [],
        creator: 'Sarah',
        kind: 'breastMilk',
        method: 'leftBreast',
        durationMinutes: 20,
      },
      NOW,
    );
    expect(Date.parse(body.end as string)).toBeLessThanOrEqual(NOW);
  });
});

describe('round-trip', () => {
  it('survives medication → wire → internal unchanged', () => {
    const original: MedicationEntry = {
      id: 'medication:3',
      childId: '2',
      type: 'medication',
      time: '2026-07-19T10:00:00Z',
      tags: [{ label: 'by Sarah', author: true }],
      creator: 'Sarah',
      name: 'Tylenol',
      dose: 2.5,
      doseUnit: 'ml',
      schedule: 'asNeeded',
      repeatHours: 6.5,
    };
    const wire = denormalize(original);
    const back = normalizeMedication({
      id: 3,
      child: 2,
      name: wire.name as string,
      dosage: wire.dosage as number,
      dosage_unit: wire.dosage_unit as 'ml',
      time: wire.time as string,
      next_dose_interval: wire.next_dose_interval as string,
      notes: wire.notes as string,
      tags: wire.tags as string[],
    });
    expect(back).toEqual(original);
  });
});

describe('timers', () => {
  it('classifies a server timer by its app-namespaced name', () => {
    expect(
      normalizeTimer({
        id: 12,
        child: 3,
        name: 'Tummy time-BBapp:3',
        start: '2026-07-20T10:00:00Z',
      }),
    ).toEqual({
      type: 'tummyTime',
      childId: '3',
      startedAt: Date.parse('2026-07-20T10:00:00Z'),
      serverTimerId: 12,
    });
  });

  it('ignores timers it cannot attribute', () => {
    const start = '2026-07-20T10:00:00Z';
    // Someone else's timer in the Baby Buddy web UI.
    expect(normalizeTimer({ id: 1, child: 3, name: 'Quick Timer', start })).toBeNull();
    // The old, pre-namespaced name is no longer recognised as ours.
    expect(normalizeTimer({ id: 4, child: 3, name: 'Sleep', start })).toBeNull();
    // Baby Buddy allows a timer with no child; we have nowhere to file it.
    expect(normalizeTimer({ id: 2, child: null, name: 'Sleep-BBapp:2', start })).toBeNull();
    expect(normalizeTimer({ id: 3, child: 3, name: 'Sleep-BBapp:2', start: 'not a date' })).toBeNull();
  });

  it('round-trips through the wire shape', () => {
    const startedAt = Date.parse('2026-07-20T10:00:00Z');
    const wire = denormalizeTimer('feeding', '3', startedAt);
    expect(wire).toEqual({
      child: 3,
      name: 'Feeding-BBapp:1',
      start: '2026-07-20T10:00:00.000Z',
    });

    const back = normalizeTimer({
      id: 9,
      child: wire.child as number,
      name: wire.name as string,
      start: wire.start as string,
    });
    expect(back).toEqual({ type: 'feeding', childId: '3', startedAt, serverTimerId: 9 });
  });
});

describe('blank choice fields', () => {
  // Django serialises an unset choice field as "", not null. A pee-only change
  // therefore arrives with color: "" — and rejecting it drops every diaper from
  // the timeline, since each endpoint is parsed as a unit.
  it('reads a pee-only change with color: "" as having no colour', () => {
    const parsed = diaperChangeSchema.parse({
      id: 495,
      child: 1,
      time: '2026-07-20T09:08:54Z',
      wet: true,
      solid: false,
      color: '',
      amount: null,
      notes: null,
      tags: [],
    });
    expect(parsed.color).toBeUndefined();
    expect(normalizeDiaper(parsed)).toMatchObject({ pee: true, poo: false, pooColor: undefined });
  });

  it('still reads a real colour', () => {
    expect(
      diaperChangeSchema.parse({
        id: 1,
        child: 1,
        time: '2026-07-20T09:08:54Z',
        wet: false,
        solid: true,
        color: 'green',
        tags: [],
      }).color,
    ).toBe('green');
  });

  it('rejects a colour the server does not define', () => {
    expect(() =>
      diaperChangeSchema.parse({
        id: 1,
        child: 1,
        time: '2026-07-20T09:08:54Z',
        wet: false,
        solid: true,
        color: 'red',
        tags: [],
      }),
    ).toThrow();
  });

  it('reads a blank medication dosage_unit as absent', () => {
    expect(
      medicationSchema.parse({
        id: 1,
        child: 1,
        name: 'X',
        time: '2026-07-20T09:08:54Z',
        dosage_unit: '',
        tags: [],
      }).dosage_unit,
    ).toBeUndefined();
  });
});

// --- Reserved tags (Phase 8, Batch A) ---------------------------------------

describe('reserved tags', () => {
  it('strips every __ tag from the user-visible list and decodes the known ones', () => {
    const s = splitTags([
      'by Sarah',
      '__unit:paste',
      '__route:anal',
      '__bodyarea:left cheek',
      '__foodtype:fruits',
      '__defaultqty:120',
      '__defaulttime:18',
      '__maxdose24h:20',
      'daycare',
    ]);
    // The whole point: none of the seven reach the UI.
    expect(s.tags.map((t) => t.label)).toEqual(['by Sarah', 'daycare']);
    expect(s.reserved).toEqual({
      unit: 'paste',
      route: 'anal',
      bodyarea: 'left cheek',
      foodtype: 'fruits',
      defaultqty: '120',
      defaulttime: '18',
      maxdose24h: '20',
    });
  });

  it('strips a __ tag whose key we do not recognise', () => {
    // Forward compatibility: an unknown key must still never render as a chip.
    const s = splitTags(['by Sarah', '__somefuturekey:7', 'park']);
    expect(s.tags.map((t) => t.label)).toEqual(['by Sarah', 'park']);
    expect(s.reserved).toEqual({});
  });

  it('keeps colons inside a free-text reserved value', () => {
    expect(splitTags(['__bodyarea:back: upper left']).reserved.bodyarea).toBe('back: upper left');
  });

  it('refuses to write back a __ label that leaked into the tag list', () => {
    expect(
      buildTags([{ label: 'by Sarah' }, { label: '__unit:paste' }, { label: 'park' }]),
    ).toEqual(['by Sarah', 'park']);
  });
});

describe('medication units', () => {
  const base = {
    id: 'medication:9',
    childId: '2',
    type: 'medication' as const,
    time: '2026-07-19T10:00:00Z',
    tags: [{ label: 'by Sarah', author: true }],
    creator: 'Sarah',
    name: 'Tylenol',
    dose: 2.5,
    schedule: 'scheduled' as const,
    repeatHours: 6,
  };

  const roundTrip = (entry: MedicationEntry): MedicationEntry => {
    const wire = denormalize(entry);
    return normalizeMedication({
      id: 9,
      child: 2,
      name: wire.name as string,
      dosage: wire.dosage as number,
      dosage_unit: wire.dosage_unit as 'mg' | 'ml' | 'tablets' | 'drops',
      time: wire.time as string,
      next_dose_interval: wire.next_dose_interval as string,
      notes: wire.notes as string,
      tags: wire.tags as string[],
    }) as MedicationEntry;
  };

  it('carries paste as ml plus a __unit tag, and recovers it', () => {
    const entry: MedicationEntry = { ...base, doseUnit: 'paste', bodyArea: 'left cheek' };
    const wire = denormalize(entry);
    // paste is not in the server enum, so the wire value must be a legal one.
    expect(wire.dosage_unit).toBe('ml');
    expect(wire.tags).toEqual(['by Sarah', '__unit:paste', '__bodyarea:left cheek']);
    expect(roundTrip(entry)).toEqual(entry);
  });

  it('sends the four real units with no __unit tag at all', () => {
    for (const unit of ['mg', 'ml', 'tablets', 'drops'] as const) {
      const wire = denormalize({ ...base, doseUnit: unit });
      expect(wire.dosage_unit).toBe(unit);
      expect(wire.tags).toEqual(['by Sarah']);
    }
  });

  it('round-trips tablets with a route and a 24h limit', () => {
    const entry: MedicationEntry = {
      ...base,
      doseUnit: 'tablets',
      route: 'orally',
      maxDose24h: 8,
    };
    expect(roundTrip(entry)).toEqual(entry);
  });

  it('drops a route/body-area that no longer matches the unit', () => {
    // A stale __route left over from when the entry was in tablets must not
    // resurface after the user switched to drops.
    const back = normalizeMedication({
      id: 9,
      child: 2,
      name: 'Tylenol',
      dosage: 2,
      dosage_unit: 'drops',
      time: '2026-07-19T10:00:00Z',
      tags: ['__route:anal', '__bodyarea:knee'],
    }) as MedicationEntry;
    expect(back.route).toBeUndefined();
    expect(back.bodyArea).toBeUndefined();
  });

  it('ignores a route that is not one of the two allowed values', () => {
    const back = normalizeMedication({
      id: 9,
      child: 2,
      name: 'Tylenol',
      dosage: 2,
      dosage_unit: 'tablets',
      time: '2026-07-19T10:00:00Z',
      tags: ['__route:sideways'],
    }) as MedicationEntry;
    expect(back.route).toBeUndefined();
  });
});

describe('feeding baselines and food type', () => {
  it('round-trips a solid feed with its food type', () => {
    const wire = denormalize({
      id: 'feeding:4',
      childId: '2',
      type: 'feeding',
      time: '2026-07-19T10:00:00Z',
      endTime: '2026-07-19T10:20:00Z',
      tags: [{ label: 'by Sarah', author: true }],
      creator: 'Sarah',
      kind: 'solidFood',
      method: 'parentFed',
      amount: 40,
      solidFoodType: 'vegetables',
    });
    expect(wire.tags).toEqual(['by Sarah', '__foodtype:vegetables']);

    const back = normalizeFeeding({
      id: 4,
      child: 2,
      start: wire.start as string,
      end: wire.end as string,
      type: 'solid food',
      method: 'parent fed',
      amount: 40,
      tags: wire.tags as string[],
    });
    expect(back).toMatchObject({ solidFoodType: 'vegetables' });
  });

  it('captures the bottle baseline and the direct-breast baseline separately', () => {
    const bottle = denormalize({
      id: 'feeding:5',
      childId: '2',
      type: 'feeding',
      time: '2026-07-19T10:00:00Z',
      endTime: '2026-07-19T10:15:00Z',
      tags: [],
      creator: 'Sarah',
      kind: 'formula',
      method: 'bottle',
      amount: 90,
      defaultQtyAtEntry: 120,
      // Wrong-shaped baseline for this method — must not be written.
      defaultTimeAtEntry: 18,
    });
    expect(bottle.tags).toEqual(['__defaultqty:120']);

    const breast = denormalize({
      id: 'feeding:6',
      childId: '2',
      type: 'feeding',
      time: '2026-07-19T10:00:00Z',
      endTime: '2026-07-19T10:18:00Z',
      tags: [],
      creator: 'Sarah',
      kind: 'breastMilk',
      method: 'leftBreast',
      durationMinutes: 18,
      defaultQtyAtEntry: 120,
      defaultTimeAtEntry: 18,
    });
    expect(breast.tags).toEqual(['__defaulttime:18']);
  });

  it('ignores a food type on a non-solid feed', () => {
    const back = normalizeFeeding({
      id: 7,
      child: 2,
      start: '2026-07-19T10:00:00Z',
      type: 'formula',
      method: 'bottle',
      tags: ['__foodtype:fruits'],
    });
    expect(back).toMatchObject({ solidFoodType: undefined });
  });
});

describe('fields recovered from the server schema', () => {
  it('round-trips a diaper amount', () => {
    const wire = denormalize({
      id: 'diaper:1',
      childId: '2',
      type: 'diaper',
      time: '2026-07-19T10:00:00Z',
      tags: [],
      creator: 'Sarah',
      pee: true,
      poo: false,
      amount: 7,
    });
    expect(wire.amount).toBe(7);

    const back = normalizeDiaper({
      id: 1,
      child: 2,
      time: '2026-07-19T10:00:00Z',
      wet: true,
      solid: false,
      amount: 7,
      tags: [],
    });
    expect(back).toMatchObject({ amount: 7 });
  });

  it('maps sleep nap/night onto the server nap boolean', () => {
    expect(
      denormalize({
        id: 'sleep:1',
        childId: '2',
        type: 'sleep',
        time: '2026-07-19T10:00:00Z',
        endTime: '2026-07-19T11:00:00Z',
        tags: [],
        creator: 'Sarah',
        sleepType: 'nap',
      }).nap,
    ).toBe(true);

    const read = (nap: boolean | null) =>
      normalizeSleep({
        id: 1,
        child: 2,
        start: '2026-07-19T10:00:00Z',
        end: '2026-07-19T11:00:00Z',
        nap,
        tags: [],
      });
    expect(read(true)).toMatchObject({ sleepType: 'nap' });
    // A null nap is the common case on rows written by other clients.
    expect(read(null)).toMatchObject({ sleepType: 'night' });
  });
});
