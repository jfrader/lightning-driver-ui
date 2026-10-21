import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { REMEMBERED_NODE_STORAGE_KEY, THEME_STORAGE_KEY } from '../../config';
import { setWideLayout } from '../../test/environment';
import { renderApp } from '../../test/render-app';
import { api, server } from '../../test/server';

describe('phone shell', () => {
  it('signs out from More and clears every cached node read', async () => {
    let deletes = 0;
    server.use(
      http.delete(api('/session'), () => {
        deletes += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const view = renderApp('/nodes/lnd-lab');
    await screen.findByText('500,000.123 sat');

    await view.user.click(within(screen.getByRole('navigation', { name: 'Sections' })).getByRole('link', { name: 'More' }));
    await view.user.click(await screen.findByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(view.router.state.location.pathname).toBe('/login'));
    expect(deletes).toBe(1);
    expect(view.queryClient.getQueryCache().findAll({ queryKey: ['node'] })).toEqual([]);
  });

  it('marks the Wallet tab and lists its sibling destinations', async () => {
    renderApp('/nodes/lnd-lab/invoices');
    const tabs = await screen.findByRole('navigation', { name: 'Sections' });
    expect(within(tabs).getByRole('link', { name: 'Wallet' })).toHaveAttribute('aria-current', 'page');
    const wallet = screen.getByRole('navigation', { name: 'Wallet' });
    expect(within(wallet).getByRole('link', { name: 'Invoices' })).toHaveAttribute('aria-current', 'page');
    expect(within(wallet).getByRole('link', { name: 'On-chain' })).toHaveAttribute('href', '/nodes/lnd-lab/onchain');
  });

  it('always shows the unresolved count for the node, linked to its unresolved operations', async () => {
    renderApp('/nodes/lnd-lab');
    const button = await screen.findByRole('link', { name: /unresolved$/ });
    expect(button).toHaveAttribute('href', '/nodes/lnd-lab/operations?state=nonterminal');
  });
});

describe('theme', () => {
  it('opens dark on a first visit and stores nothing until a choice is made', async () => {
    renderApp('/nodes/lnd-lab');
    await screen.findByText('500,000.123 sat');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('remembers an explicit choice without touching the session, route or display unit', async () => {
    setWideLayout(true);
    const view = renderApp('/nodes/lnd-lab');
    await screen.findByText('500,000.123 sat');
    await view.user.click(within(screen.getByRole('radiogroup', { name: 'Display unit' })).getByRole('radio', { name: 'BTC' }));
    const reads = view.queryClient.getQueryCache().findAll().length;

    await view.user.click(within(screen.getByRole('radiogroup', { name: 'Theme' })).getByRole('radio', { name: 'Light' }));

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(Object.keys(window.localStorage).sort()).toEqual([REMEMBERED_NODE_STORAGE_KEY, THEME_STORAGE_KEY].sort());
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(view.router.state.location.pathname).toBe('/nodes/lnd-lab');
    expect(view.queryClient.getQueryCache().findAll().length).toBe(reads);
    expect(screen.getByText('0.00500000123 BTC')).toBeInTheDocument();
  });

  it('restores the stored choice on the next visit', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    renderApp('/nodes/lnd-lab');
    await screen.findByText('500,000.123 sat');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});

describe('command palette', () => {
  it('opens with Ctrl-K and offers only navigation and form openings', async () => {
    setWideLayout(true);
    const view = renderApp('/nodes/lnd-lab');
    await screen.findByText('500,000.123 sat');

    await view.user.keyboard('{Control>}k{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'Go to' });
    const labels = within(dialog)
      .getAllByRole('option')
      .map((option) => option.textContent);

    expect(labels).toContain('Pay invoice…');
    expect(labels).toContain('All nodes');
    for (const label of labels) expect(label).not.toMatch(/passkey|confirm|authorize/i);

    await view.user.click(within(dialog).getByRole('option', { name: 'Channels' }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/nodes/lnd-lab/channels'));
  });

  it('disables form openings the node does not allow', async () => {
    setWideLayout(true);
    const view = renderApp('/nodes/lnd-observer');
    await screen.findByRole('heading', { name: 'LND observer' });

    await view.user.keyboard('{Control>}k{/Control}');
    const dialog = await screen.findByRole('dialog', { name: 'Go to' });
    expect(within(dialog).getByRole('option', { name: 'Pay invoice…' })).toHaveAttribute('aria-disabled', 'true');
  });
});
