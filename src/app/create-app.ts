import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import type { RouterHistory } from '@tanstack/react-router';
import { clearSessionCsrfToken, sessionCsrfToken } from '../api/csrf';
import { isSessionLoss } from '../api/errors';
import { READ_STALE_MS } from '../config';
import { safeRedirectPath } from '../lib/safe-redirect';
import { createAppRouter, type AppRouter } from './router';

/**
 * Query client policy: reads are cancelable and not retried automatically; mutations never
 * retry and never pause offline (`networkMode: 'always'` fails at once instead of queueing).
 * Nothing is persisted. A 401 for the current session drops every cached node read and returns
 * to sign-in; a 401 answering a request of an earlier session leaves the newer session alone.
 */
export function createApp(history?: RouterHistory): { queryClient: QueryClient; router: AppRouter } {
  const onError = (error: unknown) => {
    if (isSessionLoss(error) && error.session === sessionCsrfToken()) handleSessionLoss();
  };
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: { retry: false, networkMode: 'always', staleTime: READ_STALE_MS },
      mutations: { retry: 0, networkMode: 'always' },
    },
  });
  const router = createAppRouter(queryClient, history);

  function handleSessionLoss() {
    clearSessionCsrfToken();
    queryClient.clear();
    const { pathname, href } = router.state.location;
    if (pathname === '/login') return;
    void router.navigate({ to: '/login', search: { redirect: safeRedirectPath(href) }, replace: true });
  }

  return { queryClient, router };
}
