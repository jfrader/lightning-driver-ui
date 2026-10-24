import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { fixture } from '../../test/fixtures';
import { renderApp } from '../../test/render-app';
import { api, safeError, server } from '../../test/server';
import { currentSession, otherSession } from '../../test/sessions';

const section = () => screen.findByRole('region', { name: 'Sessions' });

describe('More: sessions', () => {
  it('renders newest first with method, creation, expiry and a current marker without a revoke action', async () => {
    server.use(http.get(api('/sessions'), () => HttpResponse.json({ sessions: [otherSession, currentSession] })));
    renderApp('/more');
    const region = await section();
    await within(region).findByText('Current session');
    const rows = within(region).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Passkey')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Current session')).toBeInTheDocument();
    expect(within(rows[0]).queryByRole('button')).not.toBeInTheDocument();
    expect(within(rows[1]).getByText('Nostr')).toBeInTheDocument();
    for (const row of rows) {
      expect(within(row).getByText('Created')).toBeInTheDocument();
      expect(within(row).getByText('Expires')).toBeInTheDocument();
      expect(row.querySelectorAll('time')).toHaveLength(2);
    }
    expect(rows[1].querySelector('time')).toHaveAttribute('datetime', otherSession.created_at);
  });

  it('revokes another session with CSRF, shows the in-flight state and refreshes the list', async () => {
    let sessions = [currentSession, otherSession];
    let reads = 0;
    let finish: () => void = () => {};
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    server.use(
      http.get(api('/sessions'), () => { reads++; return HttpResponse.json({ sessions }); }),
      http.delete(api(`/sessions/${otherSession.id}`), async ({ request }) => {
        expect(request.headers.get('X-CSRF-Token')).toBe(fixture('session').csrf_token);
        await pending;
        sessions = [currentSession];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const view = renderApp('/more');
    const region = await section();
    await view.user.click(await within(region).findByRole('button', { name: 'Sign out' }));
    expect(within(region).getByRole('button', { name: /Signing out/ })).toHaveAttribute('aria-disabled', 'true');
    expect(within(region).getAllByRole('listitem')).toHaveLength(2);
    finish();
    expect(await within(region).findByText('No other sessions.')).toBeInTheDocument();
    expect(within(region).getAllByRole('listitem')).toHaveLength(1);
    expect(reads).toBe(2);
  });

  it('shows a failed revoke inline without removing the row and permits retry', async () => {
    server.use(
      http.get(api('/sessions'), () => HttpResponse.json({ sessions: [currentSession, otherSession] })),
      http.delete(api(`/sessions/${otherSession.id}`), () => HttpResponse.json(safeError('internal_error', 'Could not revoke session.'), { status: 500 })),
    );
    const view = renderApp('/more');
    const region = await section();
    await view.user.click(await within(region).findByRole('button', { name: 'Sign out' }));
    expect(await within(region).findByText('Could not revoke session.')).toBeInTheDocument();
    expect(within(region).getAllByRole('listitem')).toHaveLength(2);
    expect(within(region).getByRole('button', { name: 'Sign out' })).toBeEnabled();
  });

  it('shows loading and the only-current-session empty state', async () => {
    let finish: () => void = () => {};
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    server.use(http.get(api('/sessions'), async () => {
      await pending;
      return HttpResponse.json({ sessions: [currentSession] });
    }));
    renderApp('/more');
    const region = await section();
    expect(await within(region).findByRole('status')).toHaveTextContent('Loading sessions…');
    finish();
    expect(await within(region).findByText('No other sessions.')).toBeInTheDocument();
    expect(within(region).queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows a list error with retry', async () => {
    server.use(http.get(api('/sessions'), () => HttpResponse.json(safeError('internal_error', 'Could not load sessions.'), { status: 500 })));
    const view = renderApp('/more');
    const region = await section();
    expect(await within(region).findByText('Could not load sessions.')).toBeInTheDocument();
    server.use(http.get(api('/sessions'), () => HttpResponse.json({ sessions: [currentSession] })));
    await view.user.click(within(region).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(within(region).queryByText('Could not load sessions.')).not.toBeInTheDocument());
    expect(within(region).getByText('Current session')).toBeInTheDocument();
  });
});
