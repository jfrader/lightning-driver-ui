import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { setWideLayout } from '../../test/environment';
import { fixture } from '../../test/fixtures';
import { withinSection } from '../../test/queries';
import { renderApp } from '../../test/render-app';
import { api, server } from '../../test/server';

const CONNECTED = fixture('peers_page').items[0];
const GONE = { pubkey: `02${'5'.repeat(64)}`, connected: false, address: null, inbound: null };

const serve = (items: unknown[]) =>
  server.use(http.get(api('/nodes/:nodeId/peers'), () => HttpResponse.json({ ...fixture('peers_page'), items })));

describe('peers list', () => {
  it('shows key, connection, address and direction, with "Not reported" for unknowns', async () => {
    setWideLayout(true);
    serve([CONNECTED, GONE]);
    renderApp('/nodes/lnd-lab/peers');

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Connected')).toBeInTheDocument();
    expect(within(table).getByText('Disconnected')).toBeInTheDocument();
    expect(within(table).getByText('peer.example.invalid:9735')).toBeInTheDocument();
    expect(within(table).getByText('Address not reported')).toBeInTheDocument();
    expect(within(table).getByText('Outbound')).toBeInTheDocument();
    expect(within(table).getByText('Not reported')).toBeInTheDocument();
    expect(within(table).queryByRole('button')).not.toBeInTheDocument();
  });

  it('opens a connected peer with its full key and the channel and disconnect entries', async () => {
    serve([CONNECTED]);
    renderApp(`/nodes/lnd-lab/peers?selected=${CONNECTED.pubkey}`);
    const inspector = await withinSection('Peer');
    expect(inspector.getByTitle(CONNECTED.pubkey)).toHaveTextContent(CONNECTED.pubkey);
    expect(inspector.getByRole('link', { name: 'Open channel…' })).toHaveAttribute(
      'href',
      `/nodes/lnd-lab/channels/new?peer=${CONNECTED.pubkey}`,
    );
    expect(inspector.getByRole('button', { name: 'Disconnect peer…' })).toBeInTheDocument();
  });

  it('offers no channel or disconnect entry for a disconnected peer', async () => {
    serve([GONE]);
    renderApp(`/nodes/lnd-lab/peers?selected=${GONE.pubkey}`);
    const inspector = await withinSection('Peer');
    expect(inspector.getByText('Disconnected')).toBeInTheDocument();
    expect(inspector.queryByRole('link', { name: 'Open channel…' })).not.toBeInTheDocument();
    expect(inspector.queryByRole('button', { name: 'Disconnect peer…' })).not.toBeInTheDocument();
  });

  it('says when the list is empty and links to the connect form', async () => {
    serve([]);
    renderApp('/nodes/lnd-lab/peers');
    expect(await screen.findByText('No peers on this node.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Connect peer' })).toHaveAttribute('href', '/nodes/lnd-lab/peers/new');
  });
});
