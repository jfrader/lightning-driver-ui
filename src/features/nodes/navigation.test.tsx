import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { REMEMBERED_NODE_STORAGE_KEY } from '../../config';
import { setWideLayout } from '../../test/environment';
import { withinPanel } from '../../test/queries';
import { renderApp } from '../../test/render-app';

describe('landing and node selection', () => {
  it('asks for a node when none is remembered, then remembers only its ID', async () => {
    const { user, router } = renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Choose a node' })).toBeInTheDocument();
    await user.click(await screen.findByRole('link', { name: 'LND lab' }));

    expect(await screen.findByRole('heading', { name: 'LND lab' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/nodes/lnd-lab');
    await screen.findByText('500,000.123 sat');
    expect(Object.keys(window.localStorage)).toEqual([REMEMBERED_NODE_STORAGE_KEY]);
    expect(window.localStorage.getItem(REMEMBERED_NODE_STORAGE_KEY)).toBe('lnd-lab');
  });

  it('lands on the remembered node', async () => {
    window.localStorage.setItem(REMEMBERED_NODE_STORAGE_KEY, 'cln-lab');
    const { router } = renderApp('/');

    expect(await screen.findByRole('heading', { name: 'CLN lab' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/nodes/cln-lab');
  });

  it('falls back to the node list when the remembered node no longer exists', async () => {
    window.localStorage.setItem(REMEMBERED_NODE_STORAGE_KEY, 'removed-node');
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Choose a node' })).toBeInTheDocument();
    expect(window.localStorage.getItem(REMEMBERED_NODE_STORAGE_KEY)).toBeNull();
  });

  it('shows an unknown node ID as not found', async () => {
    renderApp('/nodes/removed-node');
    expect(await screen.findByText('Node not found')).toBeInTheDocument();
  });

  it('lists the fleet with each node\'s own network and access, without fund totals', async () => {
    renderApp('/fleet');
    expect(await screen.findByRole('link', { name: 'LND observer' })).toBeInTheDocument();
    expect(screen.getAllByText('Read-only')).toHaveLength(1);
    expect(screen.getByText('Testnet')).toBeInTheDocument();
    expect(within(screen.getByRole('main')).queryByText(/ (sat|BTC)$/)).not.toBeInTheDocument();
  });
});

describe('layout', () => {
  it('renders lists as labelled rows on a phone', async () => {
    renderApp('/nodes/lnd-lab/payments');
    const list = await screen.findByRole('list', { name: 'Payments' });
    expect(within(list).getAllByText('Amount').length).toBeGreaterThan(0);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders lists as a table on a desktop', async () => {
    setWideLayout(true);
    renderApp('/nodes/lnd-lab/payments');
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Payments' })).not.toBeInTheDocument();
  });
});

describe('display unit', () => {
  it('switches every amount between sats and BTC without losing precision', async () => {
    // The desktop status strip carries the unit toggle; on a phone it lives under More.
    setWideLayout(true);
    const { user } = renderApp('/nodes/lnd-lab');
    const balances = await withinPanel('Balances');
    expect(await balances.findByText('500,000.123 sat')).toBeInTheDocument();

    await user.click(within(screen.getByRole('radiogroup', { name: 'Display unit' })).getByRole('radio', { name: 'BTC' }));

    await waitFor(() => expect(balances.getByText('0.00500000123 BTC')).toBeInTheDocument());
    expect(balances.getByText('0.02000000 BTC')).toBeInTheDocument();
  });
});
