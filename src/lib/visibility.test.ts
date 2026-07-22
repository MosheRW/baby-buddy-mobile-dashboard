import type { Child } from '../api/types';
import {
  effectiveHue,
  hiddenCount,
  isChildHidden,
  isScheduleActive,
  newChildIds,
  visibleChildren,
  type KidsVisibilityState,
  type VisibilitySchedule,
} from './visibility';

function child(id: string, hue = 100): Child {
  return {
    id,
    name: `Child ${id}`,
    initial: id[0]?.toUpperCase() ?? '?',
    hue,
    birthDate: '2024-01-01',
    age: '1 year old',
    defaultFoodMl: 120,
  };
}

function emptyState(over: Partial<KidsVisibilityState> = {}): KidsVisibilityState {
  return {
    hidden: {},
    childGroupId: {},
    childAccent: {},
    childSchedule: {},
    groups: {},
    defaultVisibility: 'visible',
    ...over,
  };
}

// A fixed local time to anchor schedule tests. `getDay`/`getHours` read local
// time, which is what the schedule math uses, so building via `new Date(y,m,d,…)`
// keeps the test independent of the machine's timezone.
function at(weekday: number, hour: number, minute = 0): number {
  // 2024-06-02 is a Sunday; add `weekday` days to land on the wanted day.
  return new Date(2024, 5, 2 + weekday, hour, minute).getTime();
}

const schedule = (over: Partial<VisibilitySchedule> = {}): VisibilitySchedule => ({
  startMinute: 8 * 60,
  endMinute: 17 * 60,
  weekdays: [],
  ...over,
});

describe('isScheduleActive', () => {
  it('is active inside a same-day window', () => {
    expect(isScheduleActive(schedule(), at(0, 12))).toBe(true);
  });

  it('is inactive before the start and at/after the end', () => {
    expect(isScheduleActive(schedule(), at(0, 7, 59))).toBe(false);
    expect(isScheduleActive(schedule(), at(0, 17, 0))).toBe(false);
    expect(isScheduleActive(schedule(), at(0, 20))).toBe(false);
  });

  it('respects the weekday filter', () => {
    const weekdaysOnly = schedule({ weekdays: [1, 2, 3, 4, 5] });
    expect(isScheduleActive(weekdaysOnly, at(1, 12))).toBe(true); // Monday
    expect(isScheduleActive(weekdaysOnly, at(0, 12))).toBe(false); // Sunday
    expect(isScheduleActive(weekdaysOnly, at(6, 12))).toBe(false); // Saturday
  });

  it('treats an empty weekday list as every day', () => {
    expect(isScheduleActive(schedule(), at(0, 12))).toBe(true);
    expect(isScheduleActive(schedule(), at(6, 12))).toBe(true);
  });

  it('wraps past midnight when start > end', () => {
    const overnight = schedule({ startMinute: 22 * 60, endMinute: 6 * 60 });
    expect(isScheduleActive(overnight, at(0, 23))).toBe(true); // late night
    expect(isScheduleActive(overnight, at(0, 5))).toBe(true); // early morning
    expect(isScheduleActive(overnight, at(0, 12))).toBe(false); // midday
  });

  it('is never active for a degenerate zero-length window', () => {
    expect(isScheduleActive(schedule({ startMinute: 600, endMinute: 600 }), at(0, 10))).toBe(false);
  });
});

describe('effectiveHue', () => {
  it('prefers the child override, then the group colour, then the default hue', () => {
    const c = child('a', 100);
    expect(effectiveHue(c, emptyState())).toBe(100);

    const grouped = emptyState({
      childGroupId: { a: 'g1' },
      groups: { g1: { id: 'g1', name: 'A', accentHue: 200, order: 0 } },
    });
    expect(effectiveHue(c, grouped)).toBe(200);

    const overridden = emptyState({
      ...grouped,
      childAccent: { a: 320 },
    });
    expect(effectiveHue(c, overridden)).toBe(320);
  });
});

describe('isChildHidden', () => {
  const now = at(0, 12);

  it('hides a manually hidden child', () => {
    expect(isChildHidden(child('a'), emptyState({ hidden: { a: true } }), now)).toBe(true);
  });

  it('hides a child in a hidden group', () => {
    const state = emptyState({
      childGroupId: { a: 'g1' },
      groups: { g1: { id: 'g1', name: 'A', hidden: true, order: 0 } },
    });
    expect(isChildHidden(child('a'), state, now)).toBe(true);
  });

  it('hides a child while its own schedule is active', () => {
    const state = emptyState({ childSchedule: { a: schedule() } });
    expect(isChildHidden(child('a'), state, now)).toBe(true);
    expect(isChildHidden(child('a'), state, at(0, 20))).toBe(false);
  });

  it('hides a child while its group schedule is active', () => {
    const state = emptyState({
      childGroupId: { a: 'g1' },
      groups: { g1: { id: 'g1', name: 'A', schedule: schedule(), order: 0 } },
    });
    expect(isChildHidden(child('a'), state, now)).toBe(true);
  });

  it('shows an unaffected child', () => {
    expect(isChildHidden(child('a'), emptyState(), now)).toBe(false);
  });
});

describe('visibleChildren', () => {
  const kids = [child('a'), child('b'), child('c')];
  const now = at(0, 12);

  it('filters out hidden children in input order', () => {
    const state = emptyState({ hidden: { b: true } });
    expect(visibleChildren(kids, state, now, false).map((c) => c.id)).toEqual(['a', 'c']);
  });

  it('shows every child when a reveal is active', () => {
    const state = emptyState({ hidden: { a: true, b: true, c: true } });
    expect(visibleChildren(kids, state, now, true).map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('hiddenCount', () => {
  it('counts hidden children', () => {
    const kids = [child('a'), child('b'), child('c')];
    const state = emptyState({ hidden: { a: true, c: true } });
    expect(hiddenCount(kids, state, at(0, 12))).toBe(2);
  });
});

describe('newChildIds', () => {
  it('returns only ids not already known', () => {
    const kids = [child('a'), child('b'), child('c')];
    expect(newChildIds(kids, ['a'])).toEqual(['b', 'c']);
    expect(newChildIds(kids, ['a', 'b', 'c'])).toEqual([]);
    expect(newChildIds(kids, [])).toEqual(['a', 'b', 'c']);
  });
});
