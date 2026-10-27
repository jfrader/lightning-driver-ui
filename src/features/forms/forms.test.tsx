import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { fixture } from '../../test/fixtures';
import { mockJournal, operation } from '../../test/operation-journal';
import { renderApp } from '../../test/render-app';
import { api, safeError, server } from '../../test/server';

vi.mock('@simplewebauthn/browser', async (importOriginal) =>
  (await import('../../test/webauthn-mock')).webauthnModule(importOriginal, {
    startAuthentication: vi.fn(),
    startRegistration: vi.fn(),
  }),
);

const PEER = fixture('peers_page').items[0].pubkey;
const CHANNEL = fixture('channels_page').items[0];

function serveNode(overrides: Record<string, unknown>) {
  server.use(http.get(api('/nodes/lnd-lab'), () => HttpResponse.json({ ...fixture('node_lnd'), ...overrides })));
}

function withCapability(key: string, reason: string) {
  const node = fixture('node_lnd');
  return { capabilities: { ...node.capabilities, [key]: { enabled: false, reason } } };
}

describe('blocked forms', () => {
  it.each([
    ['an unverified identity', '/payments/new', { identity_pubkey: null }, 'The node identity is not verified.'],
    ['an unknown network', '/invoices/new', { network: 'unknown' }, 'The node identity is not verified.'],
    ['a syncing node', '/onchain/send', withCapability('send_onchain', 'syncing'), 'The node is syncing.'],
    ['an unsupported backend', '/peers/new', withCapability('connect_peer', 'unsupported'), 'LND gRPC does not support this action in Lightning Driver.'],
    ['an offline node', '/channels/new', withCapability('open_channel', 'node_offline'), 'The node is offline.'],
  ])('renders the reason and no field for %s', async (_label, path, overrides, reason) => {
    serveNode(overrides);
    renderApp(`/nodes/lnd-lab${path}`);
    const scope = within(await screen.findByRole('dialog'));
    expect(await scope.findByText(reason)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Review|Check invoice/ })).not.toBeInTheDocument();
  });
});

describe('pay invoice form', () => {
  it('checks the invoice without a lightning: prefix and shows what it says', async () => {
    const decodes: unknown[] = [];
    server.use(
      http.post(api('/nodes/:nodeId/decode'), async ({ request }) => {
        decodes.push(await request.json());
        return HttpResponse.json(fixture('decode'));
      }),
    );
    const { user } = renderApp('/nodes/lnd-lab/payments/new');
    await user.type(await screen.findByLabelText(/^Invoice/), '  LIGHTNING:SYNTHETIC_BOLT11_PAYMENT_NOT_PAYABLE ');
    await user.click(screen.getByRole('button', { name: 'Check invoice' }));

    expect(await screen.findByText('Recipient node')).toBeInTheDocument();
    expect(decodes).toEqual([{ bolt11: 'SYNTHETIC_BOLT11_PAYMENT_NOT_PAYABLE' }]);
    expect(screen.queryByLabelText(/^Amount \(/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Routing fee cap \(/)).toHaveValue('1');
  });

  it.each([
    ['expired', { expired: true }, 'This invoice expired at 13:00:00 UTC.'],
    ['for another network', { network: 'testnet', network_matches_node: false }, 'This invoice is for Testnet. LND lab is on Regtest.'],
    ['of an unverified node network', { network_matches_node: null }, 'The network of this node is not verified. Payments are disabled.'],
  ])('refuses an invoice that is %s', async (_label, decoded, sentence) => {
    server.use(http.post(api('/nodes/:nodeId/decode'), () => HttpResponse.json({ ...fixture('decode'), ...decoded })));
    const { user } = renderApp('/nodes/lnd-lab/payments/new');
    await user.type(await screen.findByLabelText(/^Invoice/), 'SYNTHETIC_BOLT11_PAYMENT_NOT_PAYABLE');
    await user.click(screen.getByRole('button', { name: 'Check invoice' }));

    expect(await screen.findByText(sentence)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review payment' })).not.toBeInTheDocument();
  });

  it('says when the text is not an invoice', async () => {
    server.use(
      http.post(api('/nodes/:nodeId/decode'), () => HttpResponse.json(safeError('invalid_invoice', 'Invalid.'), { status: 422 })),
    );
    const { user } = renderApp('/nodes/lnd-lab/payments/new');
    await user.type(await screen.findByLabelText(/^Invoice/), 'not-an-invoice');
    await user.click(screen.getByRole('button', { name: 'Check invoice' }));
    expect(await screen.findByText('This is not a valid BOLT11 invoice.')).toBeInTheDocument();
  });

  it('asks for an amount only for an amountless invoice, and bounds the fee cap', async () => {
    const calls = mockJournal({ created: operation('pay_invoice') });
    server.use(http.post(api('/nodes/:nodeId/decode'), () => HttpResponse.json({ ...fixture('decode'), amount_msat: null })));
    const { user } = renderApp('/nodes/lnd-lab/payments/new');
    await user.type(await screen.findByLabelText(/^Invoice/), 'SYNTHETIC_BOLT11_PAYMENT_NOT_PAYABLE');
    await user.click(screen.getByRole('button', { name: 'Check invoice' }));
    expect(await screen.findByText('Amount not set in invoice')).toBeInTheDocument();

    const feeCap = screen.getByLabelText(/^Routing fee cap \(/);
    await user.clear(feeCap);
    await user.type(feeCap, '100.001');
    await user.click(screen.getByRole('button', { name: 'Review payment' }));

    expect(await screen.findByText('Enter an amount for this invoice.')).toBeInTheDocument();
    expect(screen.getByText('The fee cap for this node is at most 100 sat.')).toBeInTheDocument();
    expect(calls.creates).toEqual([]);

    await user.type(screen.getByLabelText(/^Amount \(sat\)/), '1500');
    await user.clear(feeCap);
    await user.type(feeCap, '0');
    await user.click(screen.getByRole('button', { name: 'Review payment' }));
    await screen.findByRole('heading', { name: 'Review payment' });
    expect(calls.creates[0]?.body).toMatchObject({ params: { amount_msat: '1500000', max_fee_msat: '0' } });
  });
});

describe('connect peer form', () => {
  it('splits a pasted pubkey@host:port and has no default port', async () => {
    const calls = mockJournal({ created: operation('connect_peer') });
    const { user } = renderApp('/nodes/lnd-lab/peers/new');
    const port = await screen.findByLabelText(/^Port/);
    expect(port).toHaveValue('');

    await user.click(screen.getByLabelText(/^Node public key/));
    await user.paste(`${PEER}@peer.example.invalid`);
    expect(screen.getByLabelText(/^Host/)).toHaveValue('peer.example.invalid');
    expect(port).toHaveValue('');
    expect(calls.creates).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Review connection' }));
    expect(await screen.findByText('Enter a port from 1 to 65535.')).toBeInTheDocument();
    await user.type(port, '9735');
    await user.click(screen.getByRole('button', { name: 'Review connection' }));
    await screen.findByRole('heading', { name: 'Review connection' });
    expect(calls.creates[0]?.body).toEqual(operation('connect_peer').request);
  });
});

describe('open channel form', () => {
  it('prefills the peer from the peer inspector and says whether it is connected', async () => {
    renderApp(`/nodes/lnd-lab/channels/new?peer=${PEER}`);
    expect(await screen.findByLabelText(/^Peer public key/)).toHaveValue(PEER);
    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(within(screen.getByRole('radiogroup', { name: 'Visibility' })).getByRole('radio', { name: 'Public' })).toBeChecked();
  });
});

describe('close channel form', () => {
  it('names the channel being closed and creates its review with the route channel', async () => {
    const calls = mockJournal({ created: operation('close_channel') });
    const { user } = renderApp(`/nodes/lnd-lab/channels/${CHANNEL.id}/close`);
    expect(await screen.findByText('Cooperative close only. The peer must be online.')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByText('Capacity').nextElementSibling).toHaveTextContent('1,000,000 sat');

    await user.type(screen.getByLabelText(/^Fee rate/), '2');
    await user.click(screen.getByRole('button', { name: 'Review close' }));
    await screen.findByRole('heading', { name: 'Review channel close' });
    expect(calls.creates[0]?.body).toEqual({ kind: 'close_channel', params: { channel_id: CHANNEL.id, fee_rate_sat_vbyte: '2' } });
  });

  it('refuses a channel that is not on the node list', async () => {
    renderApp('/nodes/lnd-lab/channels/no-such-channel/close');
    expect(await screen.findByText("This channel is not on this node's channel list.")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Fee rate/)).not.toBeInTheDocument();
  });
});

describe('new address form', () => {
  it('creates and confirms one native SegWit address even after a double press', async () => {
    const calls = mockJournal({ created: operation('new_address') });
    const { user } = renderApp('/nodes/lnd-lab/onchain/receive');
    await user.dblClick(await within(await screen.findByRole('dialog')).findByRole('button', { name: 'Create address' }));
    await screen.findByRole('heading', { name: 'Address operation' });
    expect(calls.creates.map((call) => call.body)).toEqual([{ kind: 'new_address', params: { address_type: 'p2wpkh' } }]);
    expect(calls.confirms).toHaveLength(1);
    expect(calls.authorizes).toEqual([]);
  });
});

describe('server create errors', () => {
  it('places a field error on its field', async () => {
    server.use(
      http.post(api('/nodes/:nodeId/operations'), () =>
        HttpResponse.json(safeError('invalid_address', 'This address is not valid for Regtest.', 'not_dispatched'), { status: 422 }),
      ),
    );
    const { user } = renderApp('/nodes/lnd-lab/onchain/send');
    await user.type(await screen.findByLabelText(/^Address/), 'bcrt1qwrongnetwork');
    await user.type(screen.getByLabelText(/^Amount \(sat\)/), '10000');
    await user.type(screen.getByLabelText(/^Fee rate/), '2');
    await user.click(screen.getByRole('button', { name: 'Review send' }));

    expect(await screen.findByText('This address is not valid for Regtest.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Address/)).toBeInvalid();
    expect(screen.queryByText('Check the details')).not.toBeInTheDocument();
  });

  it('points to the unresolved operation that blocks a new one', async () => {
    const busy = safeError('resource_busy', 'Busy.', 'not_dispatched', operation('pay_invoice').id);
    server.use(http.post(api('/nodes/:nodeId/operations'), () => HttpResponse.json(busy, { status: 409 })));
    const { user } = renderApp('/nodes/lnd-lab/onchain/receive');
    await user.click(await screen.findByRole('button', { name: 'Create address' }));

    expect(await screen.findByText('Another operation on this node is unresolved.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View operation' })).toHaveAttribute(
      'href',
      `/nodes/lnd-lab/operations/${operation('pay_invoice').id}`,
    );
  });
});
