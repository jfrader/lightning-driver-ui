import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { setWideLayout } from '../../test/environment';
import { fixture } from '../../test/fixtures';
import { withinSection } from '../../test/queries';
import { renderApp } from '../../test/render-app';
import { api, readOnlyNode, server } from '../../test/server';

const CHANNEL = fixture('channels_page').items[0];
const OPENING = {
  ...CHANNEL,
  id: 'channel-synthetic-opening',
  state: 'opening' as const,
  private: false,
  local_msat: null,
  remote_msat: null,
  funding_outpoint: null,
};
const WITH_REMAINDER = {
  ...CHANNEL,
  id: 'channel-synthetic-remainder',
  short_channel_id: '812x1x0',
  private: null,
  local_msat: '300000000',
  remote_msat: '600000000',
  spendable_msat: '290000000',
};

function page(items: unknown[]) {
  return { ...fixture('channels_page'), items };
}

describe('channels list', () => {
  it('shows each channel with its own bar, exact split, state and capacity', async () => {
    setWideLayout(true);
    server.use(http.get(api('/nodes/:nodeId/channels'), () => HttpResponse.json(page([CHANNEL, OPENING, WITH_REMAINDER]))));
    renderApp('/nodes/lnd-lab/channels');

    const table = await screen.findByRole('table');
    expect(screen.getByRole('list', { name: 'Liquidity key' })).toHaveTextContent('LocalRemoteIn neither balance');
    expect(within(table).getByText('cccccccc…:0')).toBeInTheDocument();
    expect(within(table).getByText('channel-…pening')).toBeInTheDocument();
    expect(within(table).getByText('500,000.123 sat')).toBeInTheDocument();
    expect(within(table).getByText('499,999.877 sat')).toBeInTheDocument();
    expect(within(table).getByText(/· private/)).toBeInTheDocument();
    expect(within(table).getByText('Balances not reported')).toBeInTheDocument();
    expect(within(table).getAllByText('1,000,000 sat')).toHaveLength(3);
    const bars = within(table).getAllByRole('img');
    expect(bars).toHaveLength(2);
    expect(bars[1]).toHaveAccessibleName(
      'Liquidity of channel 812x1x0: Local 300,000 sat, Remote 600,000 sat, In neither balance 100,000 sat, of 1,000,000 sat capacity',
    );
    expect(within(table).queryByRole('link', { name: /Close/ })).not.toBeInTheDocument();
  });

  it('opens the selected channel in the inspector with every balance and identifier', async () => {
    server.use(http.get(api('/nodes/:nodeId/channels'), () => HttpResponse.json(page([CHANNEL, WITH_REMAINDER]))));
    renderApp(`/nodes/lnd-lab/channels?selected=${WITH_REMAINDER.id}`);

    const inspector = await withinSection('Channel 812x1x0');
    const value = (label: string) => inspector.getByText(label, { selector: 'dt' }).nextElementSibling;
    expect(value('Capacity')).toHaveTextContent('1,000,000 sat');
    expect(value('Local')).toHaveTextContent('300,000 sat');
    expect(value('Remote')).toHaveTextContent('600,000 sat');
    expect(value('In neither balance')).toHaveTextContent('100,000 sat');
    expect(value('Spendable')).toHaveTextContent('290,000 sat');
    expect(value('Visibility')).toHaveTextContent('Not reported');
    expect(value('Channel ID')).toHaveTextContent(WITH_REMAINDER.id);
    expect(value('Peer')).toHaveTextContent(CHANNEL.peer_pubkey);
    expect(value('Funding outpoint')).toHaveTextContent(CHANNEL.funding_outpoint ?? '');
    expect(inspector.getByRole('link', { name: 'Close channel…' })).toHaveAttribute(
      'href',
      `/nodes/lnd-lab/channels/${WITH_REMAINDER.id}/close`,
    );
  });

  it('shows an opening channel without a bar and without a close entry', async () => {
    server.use(http.get(api('/nodes/:nodeId/channels'), () => HttpResponse.json(page([OPENING]))));
    renderApp(`/nodes/lnd-lab/channels?selected=${OPENING.id}`);

    const inspector = await withinSection('Channel channel-…pening');
    expect(inspector.getAllByText('Balances not reported').length).toBeGreaterThan(0);
    expect(inspector.queryByRole('img')).not.toBeInTheDocument();
    expect(inspector.getByText('Funding outpoint', { selector: 'dt' }).nextElementSibling).toHaveTextContent('Not reported');
    expect(inspector.queryByRole('link', { name: 'Close channel…' })).not.toBeInTheDocument();
  });

  it('offers no close entry on a read-only node', async () => {
    server.use(http.get(api('/nodes/:nodeId/channels'), () => HttpResponse.json({ ...page([CHANNEL]), node_id: readOnlyNode.id, network: 'testnet' })));
    renderApp(`/nodes/${readOnlyNode.id}/channels?selected=${CHANNEL.id}`);
    await withinSection('Channel cccccccc…:0');
    expect(screen.queryByRole('link', { name: 'Close channel…' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Close channel/ })).not.toBeInTheDocument();
  });

  it.each([
    ['', 'No channels on this node.'],
    ['?state=closing', 'No channels in state Closing.'],
  ])('says when the list%s is empty', async (query, sentence) => {
    server.use(http.get(api('/nodes/:nodeId/channels'), () => HttpResponse.json(page([]))));
    renderApp(`/nodes/lnd-lab/channels${query}`);
    expect(await screen.findByText(sentence)).toBeInTheDocument();
  });
});
