import { ThemeProvider } from '@jfrader/ui';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { AppearanceProvider } from '../features/appearance/AppearanceProvider';
import { UnitProvider } from '../features/display/UnitProvider';
import type { AppRouter } from './router';

interface AppProps {
  queryClient: QueryClient;
  router: AppRouter;
}

export function App({ queryClient, router }: AppProps) {
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
