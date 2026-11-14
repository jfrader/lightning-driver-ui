import { ThemeProvider } from '@jfrader/ui';
import { useEffect } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { AppearanceProvider } from '../features/appearance/AppearanceProvider';
import { UnitProvider } from '../features/display/UnitProvider';
import type { AppRouter } from './router';
import { clearSession, subscribeSessionEvents } from '../features/auth/session-events';

interface AppProps {
  queryClient: QueryClient;
  router: AppRouter;
}

export function App({ queryClient, router }: AppProps) {
  useEffect(() => subscribeSessionEvents((notice) => {
    clearSession(queryClient, notice === 'session_changed');
    void router.navigate({ to: '/login', search: { notice }, replace: true });
  }), [queryClient, router]);
  return (
    <ThemeProvider>
      <AppearanceProvider>
        <QueryClientProvider client={queryClient}>
          <UnitProvider>
            <RouterProvider router={router} />
          </UnitProvider>
        </QueryClientProvider>
      </AppearanceProvider>
    </ThemeProvider>
  );
}
