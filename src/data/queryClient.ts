/**
 * The app's single QueryClient.
 *
 * A rejected token is handled once here rather than in every screen: any query
 * or mutation that fails with AuthError signs the user out, which flips the
 * navigator back to Login via the conditional auth stack.
 */
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { AuthError, ForbiddenError } from '../api/client';
import { useAuthStore } from '../stores/authStore';

function handleError(error: unknown) {
  // Only a rejected token ends the session. A 403 (ForbiddenError) means the
  // token is fine but the action isn't permitted — surface it, don't log out.
  if (error instanceof AuthError) {
    useAuthStore.getState().signOut();
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleError }),
  mutationCache: new MutationCache({ onError: handleError }),
  defaultOptions: {
    queries: {
      // A bad token or a permission denial won't fix itself on retry.
      retry: (failureCount, error) =>
        !(error instanceof AuthError) &&
        !(error instanceof ForbiddenError) &&
        failureCount < 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
