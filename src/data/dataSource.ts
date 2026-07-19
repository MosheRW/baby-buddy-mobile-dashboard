/**
 * Chooses the active data source. The real Baby Buddy client is the default;
 * flip `USE_MOCK_DATA` to run the UI against in-memory fixtures (useful for the
 * web QA preview, where a cross-origin server would be blocked by CORS).
 *
 * The source reads the session straight from the stores rather than taking it
 * as an argument, so it stays a plain module singleton that React Query calls.
 */
import type { DataSource } from '../api/babybuddy';
import { createBabyBuddyDataSource } from '../api/babybuddy';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { createMockDataSource } from './mockDataSource';

/** Set to true to run the app entirely against fixtures. */
export const USE_MOCK_DATA = false;

export const dataSource: DataSource = USE_MOCK_DATA
  ? createMockDataSource()
  : createBabyBuddyDataSource(
      () => useAuthStore.getState().session,
      (childId) => useSettingsStore.getState().defaultFoodMl[childId],
    );

export type { DataSource };
