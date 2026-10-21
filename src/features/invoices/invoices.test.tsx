import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { setWideLayout } from '../../test/environment';
import { fixture } from '../../test/fixtures';
import { withinSection } from '../../test/queries';
import { renderApp } from '../../test/render-app';
import { api, server } from '../../test/server';

const OPEN = fixture('invoices_page').items[0];
const PAID = {
  ...OPEN,
  payment_hash: 'c'.repeat(64),
  state: 'paid' as const,
  received_msat: '2500000',
  description: null,
  paid_at: '2026-10-21T12:00:30Z',
};
const LATE = { ...OPEN, payment_hash: 'e'.repeat(64), expires_at: '2026-10-21T11:00:00Z', bolt11: 'lnbcrt1late' };
const NO_TEXT = { ...OPEN, payment_hash: 'f'.repeat(64), bolt11: null };

const page = (items: unknown[]) => ({ ...fixture('invoices_page'), items });
const serve = (items: unknown[]) =>
  server.use(http.get(api('/nodes/:nodeId/invoices'), () => HttpResponse.json(page(items))));

describe('invoices list', () => {
  it('shows the contract columns with amounts side by side and expiry wording', async () => {
    setWideLayout(true);
    serve([OPEN, PAID, LATE]);
    renderApp('/nodes/lnd-lab/invoices');

    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Created (UTC)',
      'State',
      'Amount',
      'Received',
      'Expires',
      'Description',
      'Payment hash',
    ]);
    expect(within(table).getAllByText('Unpaid')).toHaveLength(2);
    expect(within(table).getByText('Paid')).toBeInTheDocument();
    expect(within(table).getByText('No description')).toBeInTheDocument();
    expect(within(table).getByText(/in 59 min/)).toBeInTheDocument();
    expect(within(table).getByText(/Expiry passed/)).toBeInTheDocument();
    expect(within(table).queryByText('Expired')).not.toBeInTheDocument();
    expect(within(table).queryByRole('button', { name: /Copy/ })).not.toBeInTheDocument();
  });

  it('shows phone rows with amount, state, description, created time and expiry', async () => {
    serve([OPEN]);
    renderApp('/nodes/lnd-lab/invoices');
    const row = within((await screen.findByRole('list', { name: 'Invoices' })).querySelector('li') as HTMLElement);
    expect(row.getByText('2,500 sat')).toBeInTheDocument();
    expect(row.getByText('Unpaid')).toBeInTheDocument();
    expect(row.getByText('Synthetic invoice')).toBeInTheDocument();
    expect(row.getByRole('link', { name: `Open invoice ${OPEN.payment_hash.slice(0, 8)}` })).toBeInTheDocument();
  });

  it('offers the exact invoice text to copy only for an open unpaid invoice', async () => {
    serve([OPEN]);
    renderApp(`/nodes/lnd-lab/invoices?selected=${OPEN.payment_hash}`);
    const inspector = await withinSection('Invoice');
    expect(inspector.getByRole('button', { name: 'Copy invoice' })).toBeInTheDocument();
    expect(inspector.getByText('Amount', { selector: 'dt' }).nextElementSibling).toHaveTextContent('2,500 sat');
    expect(inspector.getByText('Received', { selector: 'dt' }).nextElementSibling).toHaveTextContent('0 sat');
    expect(inspector.getByText('Description', { selector: 'dt' }).nextElementSibling).toHaveTextContent('Synthetic invoice');
    expect(inspector.queryByText('Paid at')).not.toBeInTheDocument();
  });

  it.each([
    ['paid', PAID],
    ['past its expiry', LATE],
  ])('offers no copy for an invoice that is %s', async (_label, invoice) => {
    serve([invoice]);
    renderApp(`/nodes/lnd-lab/invoices?selected=${invoice.payment_hash}`);
    const inspector = await withinSection('Invoice');
    expect(inspector.queryByRole('button', { name: 'Copy invoice' })).not.toBeInTheDocument();
  });

  it('shows when a paid invoice was paid', async () => {
    serve([PAID]);
    renderApp(`/nodes/lnd-lab/invoices?selected=${PAID.payment_hash}`);
    const inspector = await withinSection('Invoice');
    expect(inspector.getByText('Paid at').nextElementSibling).toHaveTextContent('12:00:30 UTC');
  });

  it('says when the node did not report the invoice text', async () => {
    serve([NO_TEXT]);
    renderApp(`/nodes/lnd-lab/invoices?selected=${NO_TEXT.payment_hash}`);
    expect(await screen.findByText('Invoice text not reported')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy invoice' })).not.toBeInTheDocument();
  });

  it.each([
    ['', 'No invoices on this node.'],
    ['?status=expired', 'No invoices in state Expired.'],
  ])('says when the list%s is empty', async (query, sentence) => {
    serve([]);
    renderApp(`/nodes/lnd-lab/invoices${query}`);
    expect(await screen.findByText(sentence)).toBeInTheDocument();
  });

  it('links to the invoice form', async () => {
    renderApp('/nodes/lnd-lab/invoices');
    expect(await screen.findByRole('link', { name: 'Create invoice' })).toHaveAttribute('href', '/nodes/lnd-lab/invoices/new');
  });
});
