import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { mockJournal, operation } from '../../test/operation-journal';
import { renderApp } from '../../test/render-app';
import { api, safeError, server } from '../../test/server';

vi.mock('@simplewebauthn/browser', async (importOriginal) =>
  (await import('../../test/webauthn-mock')).webauthnModule(importOriginal, {
    startAuthentication: vi.fn(),
    startRegistration: vi.fn(),
  }),
);

/** A form only creates a review; the review is where the one explicit confirmation happens. */
describe('receive', () => {
  it('creates a review from the form, confirms it with one explicit action, then shows the invoice with copy and QR', async () => {
    const calls = mockJournal({
      created: operation('create_invoice'),
      confirm: () => HttpResponse.json(operation('create_invoice', 'succeeded', 'completed', true)),
    });
    const { user, router } = renderApp('/nodes/lnd-lab/invoices/new');

    await user.type(await screen.findByLabelText(/^Amount \(sat\)/), '2500');
    await user.type(screen.getByLabelText(/^Description/), 'Coffee');
    await user.click(screen.getByRole('button', { name: 'Review invoice' }));

    await screen.findByRole('heading', { name: 'Review invoice' });
    expect(router.state.location.pathname).toBe(`/nodes/lnd-lab/invoices/review/${operation('create_invoice').id}`);
    expect(calls.creates.map((call) => call.body)).toEqual([
      { kind: 'create_invoice', params: { amount_msat: '2500000', description: 'Coffee', expiry_seconds: 3600 } },
    ]);
    expect(calls.confirms).toEqual([]);

    await user.click(within(screen.getByRole('dialog', { name: 'Create invoice' })).getByRole('button', { name: 'Create invoice' }));

    expect(await screen.findByRole('img', { name: 'Invoice QR code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy Invoice' })).toBeInTheDocument();
    expect(screen.getByText('SYNTHETIC_BOLT11_CREATED_NOT_PAYABLE')).toBeInTheDocument();
    expect(calls.confirms).toEqual([
      expect.objectContaining({ body: { review_digest: operation('create_invoice').review.digest, authorization_id: null } }),
    ]);
    expect(calls.authorizes).toEqual([]);
  });

  it('sends amounts beyond the JavaScript safe integer range exactly', async () => {
    const calls = mockJournal({ created: operation('create_invoice') });
    const { user } = renderApp('/nodes/lnd-lab/invoices/new');

    await user.type(await screen.findByLabelText(/^Amount \(sat\)/), '9007199254740.993');
    await user.click(screen.getByRole('button', { name: 'Review invoice' }));

    await screen.findByRole('heading', { name: 'Review invoice' });
    expect(calls.creates[0]?.body).toEqual({
      kind: 'create_invoice',
      params: { amount_msat: '9007199254740993', description: '', expiry_seconds: 3600 },
    });
  });

  it.each(['1 2', '1,2', '١٢', '1e3'])('keeps the typed entry %j as typed and creates nothing', async (text) => {
    const calls = mockJournal({ created: operation('create_invoice') });
    const { user } = renderApp('/nodes/lnd-lab/invoices/new');
    const amount = await screen.findByLabelText(/^Amount \(sat\)/);

    await user.type(amount, text);
    await user.click(screen.getByRole('button', { name: 'Review invoice' }));

    expect(amount).toHaveValue(text);
    expect(await screen.findByText('Use digits and a decimal point only, without spaces or commas.')).toBeInTheDocument();
    expect(calls.creates).toEqual([]);
  });

  it('refuses to change the unit of an invalid entry instead of rereading its digits', async () => {
    const { user } = renderApp('/nodes/lnd-lab/invoices/new');
    await user.type(await screen.findByLabelText(/^Amount \(sat\)/), '0.1234');

    await user.click(within(screen.getByRole('radiogroup', { name: 'Amount unit' })).getByRole('radio', { name: 'BTC' }));

    expect(screen.getByLabelText(/^Amount \(sat\)/)).toHaveValue('0.1234');
    expect(screen.getByText('Correct the amount before changing the unit.')).toBeInTheDocument();
  });

  it('keeps typed digits worth the same amount when the unit changes', async () => {
    const calls = mockJournal({ created: operation('create_invoice') });
    const { user } = renderApp('/nodes/lnd-lab/invoices/new');

    await user.type(await screen.findByLabelText(/^Amount \(sat\)/), '150000');
    await user.click(within(screen.getByRole('radiogroup', { name: 'Amount unit' })).getByRole('radio', { name: 'BTC' }));
    expect(screen.getByLabelText(/^Amount \(BTC\)/)).toHaveValue('0.0015');
    await user.click(screen.getByRole('button', { name: 'Review invoice' }));

    await screen.findByRole('heading', { name: 'Review invoice' });
    expect(calls.creates[0]?.body).toMatchObject({ params: { amount_msat: '150000000' } });
  });

  it('reuses the idempotency key for the same intent and starts a new one when inputs change', async () => {
    const keys: (string | null)[] = [];
    server.use(
      http.post(api('/nodes/:nodeId/operations'), ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        return HttpResponse.json(safeError('storage_unavailable', 'Storage is unavailable.', 'not_dispatched'), { status: 503 });
      }),
    );
    const { user } = renderApp('/nodes/lnd-lab/invoices/new');
    const amount = await screen.findByLabelText(/^Amount \(sat\)/);
    const create = screen.getByRole('button', { name: 'Review invoice' });

    await user.type(amount, '1000');
    await user.click(create);
    await screen.findByText('Storage is unavailable.');
    await user.click(create);
    await user.type(amount, '0');
    await user.click(create);

    await vi.waitFor(() => expect(keys).toHaveLength(3));
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });
});

describe('channel and on-chain reviews', () => {
  it('reviews a channel open through the form and shows the server review before any passkey', async () => {
    const calls = mockJournal({ created: operation('open_channel') });
    const { user } = renderApp('/nodes/lnd-lab/channels/new');

    await user.type(await screen.findByLabelText(/^Peer public key/), operation('open_channel').review.peer_pubkey ?? '');
    await user.type(screen.getByLabelText(/^Channel size \(sat\)/), '1000000');
    await user.click(await screen.findByRole('button', { name: /^Normal/ }));
    await user.click(within(screen.getByRole('radiogroup', { name: 'Visibility' })).getByRole('radio', { name: 'Private' }));
    await user.click(screen.getByRole('button', { name: 'Review channel open' }));

    expect(await screen.findByRole('button', { name: 'Open channel with passkey' })).toBeInTheDocument();
    expect(screen.getByText('Open channel', { selector: 'p' }).nextElementSibling).toHaveTextContent('1,000,000 sat');
    expect(screen.getByText('Channel capacity from this node')).toBeInTheDocument();
    expect(screen.getByText('Fee rate').closest('div')).toHaveTextContent('Requested; the final fee can differ2 sat/vB');
    expect(screen.getByText('Visibility').nextElementSibling).toHaveTextContent('Private');
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
    expect(calls.creates[0]?.body).toEqual(operation('open_channel').request);
    expect(calls.confirms).toEqual([]);
  });

  it('rejects a channel size outside the node policy before creating a review', async () => {
    const calls = mockJournal({ created: operation('open_channel') });
    const { user } = renderApp('/nodes/lnd-lab/channels/new');

    await user.type(await screen.findByLabelText(/^Peer public key/), operation('open_channel').review.peer_pubkey ?? '');
    await user.type(screen.getByLabelText(/^Channel size \(sat\)/), '50000');
    await user.type(screen.getByLabelText(/^Fee rate/), '2');
    await user.click(screen.getByRole('button', { name: 'Review channel open' }));

    expect(await screen.findByText('Enter an amount from 100,000 sat to 10,000,000 sat.')).toBeInTheDocument();
    expect(calls.creates).toEqual([]);
  });

  it('reviews a fixed-amount on-chain send with its fee estimate marked as an estimate', async () => {
    const calls = mockJournal({ created: operation('send_onchain') });
    const { user } = renderApp('/nodes/lnd-lab/onchain/send');

    await user.type(await screen.findByLabelText(/^Address/), 'SYNTHETIC_REGTEST_ADDRESS_NOT_SENDABLE');
    await user.type(screen.getByLabelText(/^Amount \(sat\)/), '10000');
    await user.type(screen.getByLabelText(/^Fee rate/), '2');
    await user.click(screen.getByRole('button', { name: 'Review send' }));

    expect(await screen.findByRole('button', { name: 'Send with passkey' })).toBeInTheDocument();
    expect(screen.getByTitle('SYNTHETIC_REGTEST_ADDRESS_NOT_SENDABLE')).toBeInTheDocument();
    expect(screen.getByText('Estimated fee').closest('div')).toHaveTextContent('Estimate200 sat');
    expect(calls.creates[0]?.body).toEqual(operation('send_onchain').request);
  });

  it('labels a broadcast send as not yet confirmed', async () => {
    mockJournal({
      created: operation('send_onchain', 'succeeded', 'broadcast', true),
    });
    renderApp(`/nodes/lnd-lab/operations/${operation('send_onchain').id}`);

    expect(await screen.findByText('Broadcast by the node. Not yet in a block.')).toBeInTheDocument();
    expect(screen.queryByText('Confirmed on chain')).not.toBeInTheDocument();
  });
});
