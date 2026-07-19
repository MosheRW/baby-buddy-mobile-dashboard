/**
 * The app's single QueryClient.
 *
 * A rejected token is handled once here rather than in every screen: any query
 * or mutation that fails with AuthError signs the user out, which flips the
 * navigator back to Login via the conditional auth stack.
 */
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { AuthError } from '../api/client';
import { useAuthStore } from '../stores/authStore';

function handleError(error: unknown) {
  if (error instanceof AuthError) {
    useAuthStore.getState().signOut();
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleError }),
  mutationCache: new MutationCache({ onError: handleError }),
  defaultOptions: {
    queries: {
      // A bad token or a missing record won't fix itself on retry.
      retry: (failureCount, error) => !(error instanceof AuthError) && failureCount < 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
