import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { REMEMBERED_NODE_STORAGE_KEY } from '../../config';
import { formatDurationSeconds } from '../../lib/duration';
import { setWideLayout } from '../../test/environment';
import { fixture } from '../../test/fixtures';
import { renderApp } from '../../test/render-app';
import { api, server } from '../../test/server';

const webauthn = vi.hoisted(() => ({ startAuthentication: vi.fn(), startRegistration: vi.fn() }));
vi.mock('@simplewebauthn/browser', async (importOriginal) =>
  (await import('../../test/webauthn-mock')).webauthnModule(importOriginal, webauthn),
);

const fact = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling;

describe('More (screens spec §5)', () => {
  it('holds theme, unit, session, sign out and the app version, in that order and nothing else', async () => {
    renderApp('/more');
    await screen.findByRole('heading', { name: 'More' });
    const main = screen.getByRole('main');

    expect(within(main).getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      'More',
      'Theme',
      'Amount unit',
      'Session',
    ]);
    expect(within(main).getByRole('radiogroup', { name: 'Theme' })).toBeInTheDocument();
    expect(within(main).getByRole('radiogroup', { name: 'Display unit' })).toBeInTheDocument();
    expect(within(main).getAllByRole('radiogroup')).toHaveLength(2);
    expect(within(main).getAllByRole('button').map((button) => button.textContent)).toEqual(['Sign out']);
    expect(within(main).queryAllByRole('link')).toEqual([]);
    expect(within(main).getByText('App version 0.0.0')).toBeInTheDocument();
  });

  it('reads the session in UTC, with the absolute end relative to now', async () => {
    renderApp('/more');
    await waitFor(() => expect(fact('Signed in')).toHaveTextContent('Oct 21, 2026, 12:00:00 UTC'));
    expect(fact('Session ends')).toHaveTextContent('Oct 21, 2026, 20:00:00 UTC · in 8 hours');
    expect(fact('Ends if idle')).toHaveTextContent('Oct 21, 2026, 12:15:00 UTC');
    expect(fact('Confirmation')).toHaveTextContent('Passkey for every payment');
  });

  it('names the recent-passkey window as a duration', async () => {
    server.use(
      http.get(api('/session'), () =>
        HttpResponse.json({ ...fixture('session'), reauth: { mode: 'recent', recent_auth_seconds: 300 } }),
      ),
    );
    renderApp('/more');
    await waitFor(() =>
      expect(fact('Confirmation')).toHaveTextContent(`Passkey if not used recently · ${formatDurationSeconds(300)}`),
    );
  });

  it('keeps the unit for this tab only: nothing new in storage', async () => {
    const view = renderApp('/more');
    const units = await screen.findByRole('radiogroup', { name: 'Display unit' });
    await view.user.click(within(units).getByRole('radio', { name: 'BTC' }));
    expect(within(units).getByRole('radio', { name: 'BTC' })).toBeChecked();
    expect(Object.keys(window.localStorage).filter((key) => key !== REMEMBERED_NODE_STORAGE_KEY)).toEqual([]);
  });

  it('signs out to sign-in with the Signed out notice', async () => {
    server.use(http.delete(api('/session'), () => new HttpResponse(null, { status: 204 })));
    const view = renderApp('/more');
    await view.user.click(await screen.findByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(view.router.state.location.pathname).toBe('/login'));
    expect(view.router.state.location.search).toEqual({ notice: 'signed_out' });
    expect(await screen.findByText('Signed out.')).toBeInTheDocument();
  });

  it('is not a desktop page: the workbench opens instead', async () => {
    setWideLayout(true);
    window.localStorage.setItem(REMEMBERED_NODE_STORAGE_KEY, 'lnd-lab');
    const view = renderApp('/more');
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/nodes/lnd-lab'));
    expect(screen.getByText('App version 0.0.0')).toBeInTheDocument();
  });
});
