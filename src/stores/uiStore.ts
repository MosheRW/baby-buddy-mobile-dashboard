/**
 * Ephemeral UI state — deliberately *not* persisted and not per-screen.
 *
 * The welcome block hides after any interaction with the dashboard and stays
 * hidden for the rest of the session. Screen-local state would resurrect it
 * every time the dashboard remounts (which happens on every navigation back
 * from the form), and persisted state would hide it forever after one tap.
 *
 * `revealHiddenUntil` is the "show hidden kids for a few minutes" window opened
 * by a shake or the dashboard button — a timestamp, session-only. Persisting it
 * would leave the dashboard revealed after a relaunch; storing it per-screen
 * would drop the reveal on every navigation.
 */
import { create } from 'zustand';

interface UiState {
  welcomeDismissed: boolean;
  dismissWelcome: () => void;
  /** ms timestamp until which hidden children are temporarily shown, or null. */
  revealHiddenUntil: number | null;
  /** Reveal hidden children for `durationMs` from now. */
  revealHidden: (durationMs: number) => void;
  clearReveal: () => void;
  /**
   * ms timestamp until which the "admin isn't necessary" warning stays hidden
   * (the sharing screen's "don't warn me again for 15 minutes"). Session-only
   * like the reveal window: a relaunch should start warning again, since the
   * whole point is to make granting admin a deliberate act.
   */
  staffWarningHiddenUntil: number | null;
  suppressStaffWarning: (durationMs: number) => void;
}

export const useUiStore = create<UiState>((set) => ({
  welcomeDismissed: false,
  dismissWelcome: () => set({ welcomeDismissed: true }),
  revealHiddenUntil: null,
  revealHidden: (durationMs) => set({ revealHiddenUntil: Date.now() + durationMs }),
  clearReveal: () => set({ revealHiddenUntil: null }),
  staffWarningHiddenUntil: null,
  suppressStaffWarning: (durationMs) =>
    set({ staffWarningHiddenUntil: Date.now() + durationMs }),
}));
