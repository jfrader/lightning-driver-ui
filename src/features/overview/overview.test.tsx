import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { fixture } from '../../test/fixtures';
import { operation } from '../../test/operation-journal';
import { withinSection } from '../../test/queries';
import { renderApp } from '../../test/render-app';
import { api, server } from '../../test/server';

function unresolvedPage(items: unknown[]) {
  return { ...fixture('operations_page'), node_id: 'lnd-lab', network: 'regtest', items, next_cursor: null, truncated: false };
}

describe('overview', () => {
  it('lists each operation without a final outcome, with what is known and no retry', async () => {
    const unknown = { ...operation('pay_invoice', 'unknown', 'reconciling'), last_reconciled_at: '2026-10-21T12:00:30Z' };
    const pending = { ...operation('send_onchain', 'pending', 'submitted'), created_at: '2026-10-21T11:00:00Z' };
    const awaiting = operation('create_invoice');
    server.use(
      http.get(api('/nodes/:nodeId/operations'), () => HttpResponse.json(unresolvedPage([pending, unknown, awaiting]))),
    );
    renderApp('/nodes/lnd-lab');

    const attention = await withinSection('Needs attention');
    const items = attention.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    const [first, second] = items.map((item) => within(item));
    expect(first.getByRole('heading', { name: 'Payment outcome unknown' })).toBeInTheDocument();
    expect(
      first.getByText('The node may have sent this payment. Do not pay this invoice again until the outcome resolves.'),
    ).toBeInTheDocument();
    expect(first.getByText(/Last checked with the node/)).toHaveTextContent('Last checked with the node 12:00:30 UTC · 30 seconds ago');
    expect(first.getByRole('link', { name: 'View operation' })).toHaveAttribute(
      'href',
      `/nodes/lnd-lab/operations/${unknown.id}`,
    );
    expect(second.getByRole('heading', { name: 'Operation pending' })).toBeInTheDocument();
    expect(second.getByText('Not checked with the node yet')).toBeInTheDocument();
    expect(attention.queryByRole('button', { name: /retry|again|pay/i })).not.toBeInTheDocument();
  });

  it("refuses a journal page carrying another node's operation", async () => {
    const foreign = fixture('operations_page').items[0];
    server.use(http.get(api('/nodes/:nodeId/operations'), () => HttpResponse.json(unresolvedPage([foreign]))));
    renderApp('/nodes/lnd-lab');

    const attention = await withinSection('Needs attention');
    expect(await attention.findByText('Unexpected response')).toBeInTheDocument();
    expect(attention.queryByRole('link', { name: 'View operation' })).not.toBeInTheDocument();
  });

  it('shows no attention section when nothing is unresolved', async () => {
    renderApp('/nodes/lnd-lab');
    await withinSection('Balances');
    expect(screen.queryByRole('region', { name: 'Needs attention' })).not.toBeInTheDocument();
  });

  it('shows exact balances per group with complementary shares', async () => {
    renderApp('/nodes/lnd-lab');
    const onchain = await withinSection('On-chain');
    const channels = await withinSection('Lightning channels');
    expect(await onchain.findByText('2,000,000 sat')).toBeInTheDocument();
    expect(onchain.getByText('Confirmed 99.5% · Unconfirmed 0.5%')).toBeInTheDocument();
    expect(channels.getByText('Local balance 50.0% · Remote balance 50.0%')).toBeInTheDocument();
    expect(onchain.getByRole('img', { name: /On-chain composition: Confirmed 2,000,000 sat, Unconfirmed 10,000 sat/ })).toBeInTheDocument();
  });

  it('offers one accent action and opens forms only', async () => {
    renderApp('/nodes/lnd-lab');
    expect(await screen.findByRole('link', { name: 'Pay invoice' })).toHaveAttribute('href', '/nodes/lnd-lab/payments/new');
    expect(screen.getByRole('link', { name: 'Receive' })).toHaveAttribute('href', '/nodes/lnd-lab/invoices/new');
    for (const name of ['New address', 'Send on-chain', 'Open channel']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('lists recent payments that open in the Payments inspector', async () => {
    renderApp('/nodes/lnd-lab');
    const recent = await withinSection('Recent payments');
    expect(await recent.findByText('2,500 sat')).toBeInTheDocument();
    expect(recent.getByText('Succeeded')).toBeInTheDocument();
    const hash = fixture('payments_page').items[0].payment_hash;
    expect(recent.getByRole('link', { name: `Open payment ${hash.slice(0, 8)}` })).toHaveAttribute(
      'href',
      `/nodes/lnd-lab/payments?selected=${hash}`,
    );
    expect(recent.getByRole('link', { name: 'All payments' })).toHaveAttribute('href', '/nodes/lnd-lab/payments');
  });
});
