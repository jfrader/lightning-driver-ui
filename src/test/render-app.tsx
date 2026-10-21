import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from '@tanstack/react-router';
import { App } from '../app/App';
import { createApp } from '../app/create-app';

/** Renders the real app (router, query client, providers) at `path` against MSW handlers. */
export function renderApp(path: string) {
  const history = createMemoryHistory({ initialEntries: [path] });
  const { queryClient, router } = createApp(history);
  const user = userEvent.setup();
  const view = render(<App queryClient={queryClient} router={router} />);
  return { ...view, queryClient, router, history, user };
}
