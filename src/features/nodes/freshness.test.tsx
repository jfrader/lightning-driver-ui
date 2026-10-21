import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { fixture } from '../../test/fixtures';
import { withinPanel } from '../../test/queries';
import { renderApp } from '../../test/render-app';
import { api, readOnlyNode, safeError, server, writableNode } from '../../test/server';

const balancesPanel = () => withinPanel('Balances');

describe('node data freshness', () => {
  it('marks a cached observation from an offline node as stale with its age', async () => {
    renderApp(`/nodes/${readOnlyNode.id}`);
    const panel = await balancesPanel();
    expect(await panel.findByText('Stale')).toBeInTheDocument();
    expect(panel.getByText('Observed 6 minutes ago')).toBeInTheDocument();
  });

  it('shows missing balances as unavailable, never as zero', async () => {
    renderApp(`/nodes/${readOnlyNode.id}`);
    const panel = await balancesPanel();
    expect(await panel.findByText('120,000 sat')).toBeInTheDocument();
    expect(panel.getAllByText('Unavailable')).toHaveLength(4);
    for (const label of ['On-chain spendable', 'Channels local', 'Channels remote', 'Channels spendable']) {
      expect(panel.getByText(label).nextElementSibling).toHaveTextContent('Unavailable');
    }
    expect(panel.getByText('On-chain unconfirmed').nextElementSibling).toHaveTextContent('0 sat');
  });

  it('shows an offline node without an observation as unavailable instead of empty balances', async () => {
    server.use(
      http.get(api('/nodes/:nodeId/balances'), () =>
        HttpResponse.json(fixture('offline_no_observation_error'), { status: 503 }),
      ),
    );
    renderApp(`/nodes/${writableNode.id}`);
    const panel = await balancesPanel();
    expect(await panel.findByText('Node offline. No saved observation is available.')).toBeInTheDocument();
    expect(panel.queryByText(/sat$/)).not.toBeInTheDocument();
  });

  it('refuses balances that belong to another node', async () => {
    server.use(
      http.get(api('/nodes/:nodeId/balances'), () => HttpResponse.json({ ...fixture('balances'), node_id: 'cln-lab' })),
    );
    renderApp(`/nodes/${writableNode.id}`);
    const panel = await balancesPanel();
    expect(await panel.findByText('Unexpected response')).toBeInTheDocument();
    expect(panel.queryByText('500,000.123 sat')).not.toBeInTheDocument();
  });

  it.each([
    ['an exponent', '5e8'],
    ['a fraction', '500000.5'],
    ['a value above i64', '9223372036854775808'],
    ['a JSON number', 500000123],
  ])('fails visibly on a wire amount with %s', async (_label, value) => {
    server.use(
      http.get(api('/nodes/:nodeId/balances'), () =>
        HttpResponse.json({ ...fixture('balances'), channel_local_msat: value }),
      ),
    );
    renderApp(`/nodes/${writableNode.id}`);
    const panel = await balancesPanel();
    expect(await panel.findByText('Unexpected response')).toBeInTheDocument();
    expect(panel.queryByText(/sat$/)).not.toBeInTheDocument();
  });

  it('does not show one node\'s list under another node', async () => {
    server.use(
      http.get(api('/nodes/:nodeId/payments'), () =>
        HttpResponse.json({ ...fixture('payments_page'), node_id: writableNode.id }),
      ),
    );
    renderApp(`/nodes/cln-lab/payments`);
    expect(await screen.findByText('Unexpected response')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Payments' })).not.toBeInTheDocument();
  });

  it('reports server errors on lists with a safe message and request ID', async () => {
    server.use(
      http.get(api('/nodes/:nodeId/channels'), () =>
        HttpResponse.json(safeError('upstream_invalid_response', 'The node returned data the server cannot read.'), {
          status: 502,
        }),
      ),
    );
    renderApp(`/nodes/${writableNode.id}/channels`);
    expect(await screen.findByText('The node returned data the server cannot read.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy request ID' })).toBeInTheDocument();
  });
});
