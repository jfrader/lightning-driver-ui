import { screen, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { nodeKeys } from '../../api/node-queries';
import type { Operation } from '../../api/types';
import { fixture } from '../../test/fixtures';
import { mockJournal, operation } from '../../test/operation-journal';
import { renderApp } from '../../test/render-app';
import { api, server } from '../../test/server';
import { invalidateAffectedReads } from './affected-reads';

const READS = ['invoices', 'payments', 'peers', 'channels', 'transactions', 'balances', 'operations', 'summary', 'info', 'policy'];

function seeded() {
  const client = new QueryClient();
  for (const nodeId of ['lnd-lab', 'cln-lab']) {
    for (const resource of READS) client.setQueryData(nodeKeys.list(nodeId, resource, { limit: '100' }), {});
    client.setQueryData(nodeKeys.detail(nodeId, 'balances'), {});
    client.setQueryData(nodeKeys.summary(nodeId), {});
  }
  return client;
}

const invalidated = (client: QueryClient, nodeId: string) =>
  [...new Set(client.getQueryCache().findAll({ queryKey: ['node', nodeId] }).filter((q) => q.state.isInvalidated).map((q) => String(q.queryKey[2])))].sort();

describe('reads a confirmed operation affects', () => {
  it.each([
    ['create_invoice', ['invoices', 'operations', 'summary']],
    ['pay_invoice', ['balances', 'channels', 'operations', 'payments', 'summary']],
    ['connect_peer', ['operations', 'peers', 'summary']],
    ['disconnect_peer', ['channels', 'operations', 'peers', 'summary']],
    ['open_channel', ['balances', 'channels', 'operations', 'peers', 'summary', 'transactions']],
    ['close_channel', ['balances', 'channels', 'operations', 'summary', 'transactions']],
    ['new_address', ['operations', 'summary']],
    ['send_onchain', ['balances', 'operations', 'summary', 'transactions']],
  ] as const)('%s marks %j stale on its own node only', async (kind, expected) => {
    const client = seeded();
    await invalidateAffectedReads(client, operation(kind) as unknown as Operation);
    expect(invalidated(client, 'lnd-lab')).toEqual(expected);
    expect(invalidated(client, 'cln-lab')).toEqual([]);
  });

  it('creates no cache entry once the cache was cleared (sign-out, 401)', async () => {
    const client = seeded();
    client.clear();
    await invalidateAffectedReads(client, operation('pay_invoice') as unknown as Operation);
    expect(client.getQueryCache().getAll()).toEqual([]);
  });

  it('shows a created invoice on the list already in the cache, without a reload', async () => {
    let created = false;
    server.use(
      http.get(api('/nodes/:nodeId/invoices'), () =>
        HttpResponse.json(created ? fixture('invoices_page') : { ...fixture('invoices_page'), items: [], next_cursor: null }),
      ),
    );
    mockJournal({
      created: operation('create_invoice'),
      confirm: () => {
        created = true;
        return HttpResponse.json(operation('create_invoice', 'succeeded', 'completed', true));
      },
    });
    const view = renderApp('/nodes/lnd-lab/invoices');
    expect(await screen.findByText('No invoices on this node.')).toBeInTheDocument();

    await view.router.navigate({ to: '/nodes/$nodeId/invoices/new', params: { nodeId: 'lnd-lab' } });
    await view.user.type(await screen.findByLabelText(/^Amount \(sat\)/), '2500');
    await view.user.click(screen.getByRole('button', { name: 'Review invoice' }));
    await view.user.click(await screen.findByRole('button', { name: 'Create invoice' }));
    expect(await screen.findByText('Invoice created.')).toBeInTheDocument();

    await view.router.navigate({ to: '/nodes/$nodeId/invoices', params: { nodeId: 'lnd-lab' } });
    const hash = fixture('invoices_page').items[0].payment_hash;
    await waitFor(() => expect(screen.getAllByRole('link', { name: new RegExp(`\\(Open invoice ${hash.slice(0, 8)}\\)$`) }).length).toBeGreaterThan(0));
    expect(screen.queryByText('No invoices on this node.')).not.toBeInTheDocument();
  });
});
