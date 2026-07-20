/**
 * Ephemeral UI state — deliberately *not* persisted and not per-screen.
 *
 * The welcome block hides after any interaction with the dashboard and stays
 * hidden for the rest of the session. Screen-local state would resurrect it
 * every time the dashboard remounts (which happens on every navigation back
 * from the form), and persisted state would hide it forever after one tap.
 */
import { create } from 'zustand';

interface UiState {
  welcomeDismissed: boolean;
  dismissWelcome: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  welcomeDismissed: false,
  dismissWelcome: () => set({ welcomeDismissed: true }),
}));
