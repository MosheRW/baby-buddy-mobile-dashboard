/**
 * Auth session. Persisted to secure storage (Phase 5 will store the real token
 * here too). Replaces the Phase 2 AuthContext.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Session } from '../api/types';
import { secureStorage } from './storage';

interface AuthState {
  session: Session | null;
  /** True once the persisted session has been rehydrated from storage. */
  hydrated: boolean;
  signIn: (session: Session) => void;
  signOut: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      hydrated: false,
      signIn: (session) => set({ session }),
      signOut: () => set({ session: null }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'auth',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({ session: state.session }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
