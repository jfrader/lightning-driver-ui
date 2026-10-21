import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { setWideLayout } from '../../test/environment';
import { fixture } from '../../test/fixtures';
import { withinSection } from '../../test/queries';
import { renderApp } from '../../test/render-app';
import { api, server } from '../../test/server';

const UNCONFIRMED = fixture('transactions_page').items[0];
const CONFIRMED = {
  ...UNCONFIRMED,
  txid: 'e'.repeat(64),
  direction: 'incoming' as const,
  amount_sat: '50000',
  fee_sat: null,
  confirmations: '6',
  block_height: '812345',
  outputs: [
    { index: 1, address: null, amount_sat: '1000', is_ours: null },
    { index: 0, address: 'SYNTHETIC_REGTEST_OWN_ADDRESS', amount_sat: '50000', is_ours: true },
  ],
};

const serve = (items: unknown[]) =>
  server.use(http.get(api('/nodes/:nodeId/transactions'), () => HttpResponse.json({ ...fixture('transactions_page'), items })));

describe('on-chain list', () => {
  it('shows direction, exact amounts, confirmations and block without any "final" wording', async () => {
    setWideLayout(true);
    serve([UNCONFIRMED, CONFIRMED]);
    renderApp('/nodes/lnd-lab/onchain');

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Sent')).toBeInTheDocument();
    expect(within(table).getByText('Received')).toBeInTheDocument();
    expect(within(table).getByText('10,200 sat')).toBeInTheDocument();
    expect(within(table).getByText('Unconfirmed')).toBeInTheDocument();
    expect(within(table).getByText('Not in a block')).toBeInTheDocument();
    expect(within(table).getByText('6 confirmations')).toBeInTheDocument();
    expect(within(table).getByText('812,345')).toBeInTheDocument();
    expect(within(table).getByText('Not reported')).toBeInTheDocument();
    expect(table).not.toHaveTextContent(/final|safe|settled|completed/i);
  });

  it('opens a transaction with its txid and outputs in index order', async () => {
    serve([CONFIRMED]);
    renderApp(`/nodes/lnd-lab/onchain?selected=${CONFIRMED.txid}`);

    const inspector = await withinSection('Transaction');
    expect(inspector.getByText('Wallet change').nextElementSibling).toHaveTextContent('50,000 sat');
    expect(inspector.getByText('Txid').nextElementSibling).toHaveTextContent(CONFIRMED.txid);
    const outputs = within(inspector.getByRole('list', { name: 'Outputs' })).getAllByRole('listitem');
    expect(outputs.map((output) => output.textContent)).toEqual([
      expect.stringMatching(/^#050,000 sat.*This wallet$/),
      expect.stringMatching(/^#11,000 satAddress not reportedOwner not reported$/),
    ]);
    expect(inspector.queryByText('Not yet in a block.')).not.toBeInTheDocument();
  });

  it('says an unconfirmed transaction is not yet in a block, and marks external outputs', async () => {
    serve([UNCONFIRMED]);
    renderApp(`/nodes/lnd-lab/onchain?selected=${UNCONFIRMED.txid}`);
    const inspector = await withinSection('Transaction');
    expect(inspector.getByText('Not yet in a block.')).toBeInTheDocument();
    expect(inspector.getByText('External')).toBeInTheDocument();
  });

  it('says when there are no transactions or no outputs', async () => {
    serve([{ ...CONFIRMED, outputs: [] }]);
    renderApp(`/nodes/lnd-lab/onchain?selected=${CONFIRMED.txid}`);
    expect(await screen.findByText('No outputs reported.')).toBeInTheDocument();
  });

  it('says when the list is empty and links to both on-chain forms', async () => {
    serve([]);
    renderApp('/nodes/lnd-lab/onchain');
    expect(await screen.findByText('No on-chain transactions on this node.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New address' })).toHaveAttribute('href', '/nodes/lnd-lab/onchain/receive');
    expect(screen.getByRole('link', { name: 'Send on-chain' })).toHaveAttribute('href', '/nodes/lnd-lab/onchain/send');
  });
});
