/**
 * Full sign-out cleanup. `authStore.signOut()` alone only drops the session, so
 * the previous account's cached server data and per-child preferences would
 * linger — visible when a *different* caregiver signs in on the same device
 * (Baby Buddy is multi-user). This wipes everything account-scoped.
 *
 * Deliberately kept: device preferences that aren't account data — theme
 * (`themeStore`) and language (`localeStore`). Resetting those on every logout
 * would be surprising, and they leak nothing about the previous account.
 *
 * Used by the explicit "Log out" action. The automatic sign-out on an
 * `AuthError` (an expired token) stays a plain `signOut()` — re-authenticating
 * shouldn't throw away the caregiver's settings.
 */
import type { QueryClient } from '@tanstack/react-query';
import {
  useAuthStore,
  useFormStore,
  useKidsStore,
  useNotificationStore,
  useSettingsStore,
  useTimerStore,
  useUiStore,
} from '../stores';

/**
 * Reset one store to its initial state. `getInitialState()` includes the action
 * functions, so `replace: true` restores state + actions together. Generic over
 * the store's state type so the setState signature stays callable (a mixed array
 * of stores would collapse to an uncallable union).
 */
function resetStore<S>(store: {
  getInitialState: () => S;
  setState: (state: S, replace: true) => void;
}): void {
  store.setState(store.getInitialState(), true);
}

export function performLogout(queryClient: QueryClient): void {
  // 1. Drop all cached server data (children, entries, timers).
  queryClient.clear();

  // 2. Reset account-scoped stores to their defaults. Resetting a persisted
  //    store rewrites storage with the empty defaults; clearStorage() then
  //    removes the key outright, belt-and-braces.
  resetStore(useSettingsStore);
  resetStore(useKidsStore);
  resetStore(useTimerStore);
  resetStore(useNotificationStore);
  resetStore(useFormStore);
  resetStore(useUiStore);
  void useSettingsStore.persist.clearStorage();
  void useKidsStore.persist.clearStorage();
  void useTimerStore.persist.clearStorage();
  void useNotificationStore.persist.clearStorage();

  // 3. Finally clear the session (also clears its secure-storage entry).
  useAuthStore.getState().signOut();
}
