/**
 * App-wide error channel — the single place any part of the app pushes a
 * user-facing error so the dashboard can surface it in the notification
 * carousel (alongside OS-delivered reminders). Deliberately **not** persisted:
 * an error is only meaningful for the current session, and a stale "couldn't
 * save" card resurrected after a relaunch would be misleading.
 *
 * Reactive query errors (the dashboard fetch) are *not* stored here — they live
 * in React Query and the dashboard derives a card from that state directly, so
 * the card clears the instant a refetch succeeds. This store is for **event**
 * errors that have no lingering source state of their own: a mutation that
 * failed once (save / delete). Each is keyed by a stable `id` per source, so a
 * repeated failure replaces the previous card instead of stacking duplicates,
 * and a later success can dismiss it by that same id.
 */
import { create } from 'zustand';

export interface AppError {
  /**
   * Stable key per source (e.g. `'save-entry'`, `'delete-entry'`). A new error
   * with the same id replaces the old one; a success dismisses by this id.
   */
  id: string;
  /**
   * i18n key for the card title (e.g. `'errors.saveTitle'`) — stored unresolved
   * and translated at render time, so a card already on screen relocalizes when
   * the user switches language, like every other string in the tree. `message`
   * is the underlying `errorMessage(...)`, which is not itself translatable.
   */
  titleKey: string;
  message: string;
  /** The child the failed action was about, if any — drives the card's chip. */
  childId?: string;
}

interface AppErrorState {
  errors: AppError[];
  /** Add or replace the error for its `id`, moving it to the front (newest first). */
  pushError: (error: AppError) => void;
  dismissError: (id: string) => void;
  clearErrors: () => void;
}

export const useAppErrorStore = create<AppErrorState>((set) => ({
  errors: [],
  pushError: (error) =>
    set((s) => ({ errors: [error, ...s.errors.filter((e) => e.id !== error.id)] })),
  dismissError: (id) => set((s) => ({ errors: s.errors.filter((e) => e.id !== id) })),
  clearErrors: () => set({ errors: [] }),
}));
