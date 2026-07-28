/**
 * Chooses the active data source per call, from the current session:
 *  - `USE_MOCK_DATA` → in-memory fixtures (web QA preview; CORS blocks a real
 *    server in the browser).
 *  - a `local` session → the offline, on-device source (`localDataSource`).
 *  - anything else → the real Baby Buddy REST client.
 *
 * The choice is made per method call (not once at import) because the login mode
 * isn't known until the user signs in. Sources read the session/settings straight
 * from the stores, so this stays a plain module singleton that React Query calls.
 */
import type { DataSource } from '../api/babybuddy';
import { createBabyBuddyDataSource } from '../api/babybuddy';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { createMockDataSource } from './mockDataSource';
import { createLocalDataSource } from './localDataSource';

/** Set to true to run the app entirely against fixtures. */
export const USE_MOCK_DATA = false;

const getDefaultFoodMl = (childId: string) => useSettingsStore.getState().defaultFoodMl[childId];

const mock = createMockDataSource();
const local = createLocalDataSource(undefined, getDefaultFoodMl);
const babybuddy = createBabyBuddyDataSource(
  () => useAuthStore.getState().session,
  getDefaultFoodMl,
);

/** The source backing the current session. */
function active(): DataSource {
  if (USE_MOCK_DATA) return mock;
  return useAuthStore.getState().session?.mode === 'local' ? local : babybuddy;
}

export const dataSource: DataSource = {
  getChildren: (signal) => active().getChildren(signal),
  getEntries: (signal) => active().getEntries(signal),
  createEntry: (entry) => active().createEntry(entry),
  updateEntry: (entry) => active().updateEntry(entry),
  deleteEntry: (id) => active().deleteEntry(id),
  getTimers: (signal) => active().getTimers(signal),
  startTimer: (type, childId, startedAt) => active().startTimer(type, childId, startedAt),
  stopTimer: (serverTimerId) => active().stopTimer(serverTimerId),
  updateTimerStart: (serverTimerId, startedAt) =>
    active().updateTimerStart(serverTimerId, startedAt),
};

export type { DataSource };
