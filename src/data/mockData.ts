/**
 * Static demo data mirroring the prototype (Emma 7mo + Noah). Times are
 * generated relative to "now" so the dashboard's time-since labels read
 * sensibly whenever the app is opened. This module is the Phase 2 stand-in for
 * the real API client (Phase 5) — everything consumes it through `dataSource`.
 */
import type { Child, Entry, Tag } from '../api/types';

export const CURRENT_USER = 'Sarah';

function authorTag(): Tag {
  return { label: `by ${CURRENT_USER}`, author: true };
}

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** ISO string for `ms` milliseconds before now. */
function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

export const mockChildren: Child[] = [
  { id: 'c1', name: 'Emma', initial: 'E', hue: 30, age: '7 months old', defaultFoodMl: 120 },
  { id: 'c2', name: 'Noah', initial: 'N', hue: 200, age: '2 years old', defaultFoodMl: 150 },
];

export const mockEntries: Entry[] = [
  // --- Emma ---
  {
    id: 'e1',
    childId: 'c1',
    type: 'diaper',
    time: ago(45 * MIN),
    tags: [authorTag()],
    creator: CURRENT_USER,
    pee: true,
    poo: false,
  },
  {
    id: 'e2',
    childId: 'c1',
    type: 'diaper',
    time: ago(3 * HOUR),
    tags: [authorTag()],
    creator: CURRENT_USER,
    pee: true,
    poo: true,
    pooColor: 'brown',
  },
  {
    id: 'e3',
    childId: 'c1',
    type: 'feeding',
    time: ago(1 * HOUR + 20 * MIN),
    tags: [authorTag()],
    creator: CURRENT_USER,
    kind: 'formula',
    method: 'bottle',
    amount: 120,
  },
  {
    id: 'e4',
    childId: 'c1',
    type: 'feeding',
    time: ago(4 * HOUR),
    tags: [authorTag()],
    creator: CURRENT_USER,
    kind: 'formula',
    method: 'bottle',
    amount: 100,
  },
  {
    id: 'e5',
    childId: 'c1',
    type: 'medication',
    time: ago(1 * HOUR),
    tags: [authorTag()],
    creator: CURRENT_USER,
    name: 'Amoxicillin',
    dose: 5,
    doseUnit: 'mg',
    schedule: 'scheduled',
    repeatHours: 8,
  },
  {
    id: 'e6',
    childId: 'c1',
    type: 'medication',
    time: ago(2 * DAY),
    tags: [authorTag()],
    creator: CURRENT_USER,
    name: 'Tylenol',
    dose: 2.5,
    doseUnit: 'mg',
    schedule: 'asNeeded',
    repeatHours: 6,
  },
  {
    id: 'e7',
    childId: 'c1',
    type: 'sleep',
    time: ago(6 * HOUR),
    endTime: ago(4 * HOUR - 30 * MIN),
    sleepType: 'nap',
    // Real tags on a couple of fixtures, so the form's tag quick-pick and the
    // feed's tag row have something to render in the mock preview.
    tags: [authorTag(), { label: 'swaddled' }, { label: 'white noise' }],
    creator: CURRENT_USER,
    note: 'Napped well',
  },
  {
    id: 'e8',
    childId: 'c1',
    type: 'temperature',
    time: ago(1 * DAY),
    tags: [authorTag()],
    creator: CURRENT_USER,
    value: 37.2,
    method: 'ear',
  },
  // --- Noah ---
  {
    id: 'e9',
    childId: 'c2',
    type: 'diaper',
    time: ago(2 * HOUR),
    tags: [authorTag()],
    creator: CURRENT_USER,
    pee: true,
    poo: false,
  },
  {
    id: 'e10',
    childId: 'c2',
    type: 'feeding',
    time: ago(50 * MIN),
    tags: [authorTag()],
    creator: CURRENT_USER,
    kind: 'solidFood',
    method: 'selfFed',
    amount: 80,
  },
  {
    id: 'e11',
    childId: 'c2',
    type: 'tummyTime',
    time: ago(1 * DAY + 3 * HOUR),
    endTime: ago(1 * DAY + 3 * HOUR - 12 * MIN),
    tags: [authorTag()],
    creator: CURRENT_USER,
    durationMinutes: 12,
  },
];
