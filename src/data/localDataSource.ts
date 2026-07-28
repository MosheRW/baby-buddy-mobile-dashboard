/**
 * The offline `DataSource`, backed by `localDataStore` (AsyncStorage). It makes
 * the server-less "local" login mode behave exactly like the real client from
 * the app's point of view: same interface, same id shapes, same sort order — so
 * React Query, the timer sync and the notification planner need no special case.
 *
 * Unlike the Baby Buddy source there is no clock to reconcile against: entries
 * are stored as the form built them (device time), never denormalized.
 */
import type { DataSource } from '../api/babybuddy';
import { ageLabel } from '../api/normalize';
import { useLocalDataStore, type LocalDataState } from './localDataStore';

/** Minimal store surface the source needs, so tests can pass a vanilla store. */
type LocalStore = { getState: () => LocalDataState };

export function createLocalDataSource(
  store: LocalStore = useLocalDataStore,
  getDefaultFoodMl: (childId: string) => number | undefined = () => undefined,
): DataSource {
  const state = () => store.getState();

  return {
    async getChildren() {
      const now = Date.now();
      return state().children.map((child) => ({
        ...child,
        // Recompute the age label at fetch time (like normalizeChild does), and
        // fold in any per-child default-food override set in Settings.
        age: ageLabel(child.birthDate, now),
        defaultFoodMl: getDefaultFoodMl(child.id) ?? child.defaultFoodMl,
      }));
    },

    async getEntries() {
      return [...state().entries].sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
    },

    async createEntry(entry) {
      return state().insertEntry(entry);
    },

    async updateEntry(entry) {
      return state().patchEntry(entry);
    },

    async deleteEntry(id) {
      state().removeEntry(id);
    },

    async getTimers() {
      return [...state().timers].sort((a, b) => a.startedAt - b.startedAt);
    },

    async startTimer(type, childId, startedAt) {
      return state().insertTimer(type, childId, startedAt);
    },

    async stopTimer(serverTimerId) {
      state().removeTimer(serverTimerId);
    },

    async updateTimerStart(serverTimerId, startedAt) {
      const timer = state().patchTimerStart(serverTimerId, startedAt);
      if (!timer) throw new Error(`No local timer with id ${serverTimerId}.`);
      return timer;
    },
  };
}
