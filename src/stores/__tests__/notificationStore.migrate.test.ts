/**
 * The persisted-state migration, exercised directly.
 *
 * Worth a test of its own because it is the one part of this store that runs
 * against data this build never wrote. v6 promoted `foodMin` from a bare
 * `{ enabled }` to the full before/at/after `CaseSettings` the medication cases
 * use — and the planner reads `settings.foodMin.timing` unconditionally, so a
 * blob that came through without one takes the first rebuild down with it. An
 * existing install is exactly the case a fresh-defaults smoke test can't reach.
 */
import { useNotificationStore } from '../notificationStore';
import type { NotificationSettings } from '../../lib/notifications';

// The store imports AsyncStorage transitively (via `stores/storage`), whose
// native module isn't linked under Jest — the package's own mock is the
// documented substitute. Nothing here touches storage; it just has to import.
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

type Migrate = (persisted: unknown, version: number) => NotificationSettings & {
  remindOnTime?: Record<string, number>;
};

const migrate = useNotificationStore.persist.getOptions().migrate as unknown as Migrate;

/** A v5 blob, i.e. what the build before this one persisted. */
const v5 = () => ({
  masterEnabled: true,
  foodMin: { enabled: true },
  snoozeMinutes: 15,
  snoozedUntil: {},
});

describe('notificationStore migrate → v6', () => {
  it('gives a pre-v6 foodMin the timing the planner requires', () => {
    const state = migrate(v5(), 5);
    expect(state.foodMin.enabled).toBe(true);
    expect(state.foodMin.timing).toEqual({
      before: false,
      beforeMinutes: 15,
      at: true,
      after: false,
      afterMinutes: 15,
    });
  });

  it('seeds the remind-on-time map', () => {
    expect(migrate(v5(), 5).remindOnTime).toEqual({});
  });

  it('leaves an already-migrated foodMin alone', () => {
    const timing = {
      before: true,
      beforeMinutes: 30,
      at: false,
      after: true,
      afterMinutes: 20,
    };
    const state = migrate({ ...v5(), foodMin: { enabled: false, timing }, remindOnTime: {} }, 6);
    expect(state.foodMin).toEqual({ enabled: false, timing });
  });
});
