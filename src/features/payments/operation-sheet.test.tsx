import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { fixture } from '../../test/fixtures';
import { mockJournal, operation } from '../../test/operation-journal';
import { renderApp } from '../../test/render-app';
import { api, server } from '../../test/server';

describe('payment operation sheet', () => {
  it('opens and closes over the same list with its filter, sort and selection intact', async () => {
    const selected = fixture('payments_page').items[0].payment_hash;
    const view = renderApp(`/nodes/lnd-lab/payments?status=succeeded&sort=amount&dir=asc&selected=${selected}`);
    const heading = await screen.findByRole('heading', { name: 'Payments' });
    const search = view.router.state.location.search;
    await view.user.click(screen.getByRole('button', { name: 'Pay invoice' }));
    const dialog = await screen.findByRole('dialog', { name: 'Send and receive' });
    expect(screen.getByRole('heading', { name: 'Payments' })).toBe(heading);
    expect(view.router.state.location.pathname).toBe('/nodes/lnd-lab/payments');
    expect(view.router.state.location.search).toEqual({ ...search, send: 1, action: 'pay_invoice' });
    await view.user.keyboard('{Escape}');
    await within(dialog).findByRole('menuitem', { name: 'Pay invoice' });
    await view.user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Send and receive' })).not.toBeInTheDocument());
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/nodes/lnd-lab/payments'));
    expect(view.router.state.location.search).toEqual(search);
    expect(screen.getByRole('heading', { name: 'Payments' })).toBe(heading);
  });

  it('names the review in the URL and keeps the list behind it', async () => {
    const created = operation('pay_invoice');
    const calls = mockJournal({ created });
    const view = renderApp('/nodes/lnd-lab/payments/new?sort=amount');
    await view.user.type(await screen.findByLabelText(/^Invoice/), 'SYNTHETIC_BOLT11_PAYMENT_NOT_PAYABLE');
    await view.user.click(screen.getByRole('button', { name: 'Check invoice' }));
    await view.user.click(await screen.findByRole('button', { name: 'Review payment' }));
    await screen.findByRole('button', { name: 'Pay with passkey' });
    expect(view.router.state.location.pathname).toBe(`/nodes/lnd-lab/payments/review/${created.id}`);
    expect(view.router.state.location.search).toMatchObject({ sort: 'amount' });
    expect(screen.getByRole('heading', { name: 'Payments' })).toBeInTheDocument();
    const dialog = screen.getByRole('dialog', { name: 'Pay invoice' });
    expect(fireEvent(dialog, new Event('cancel', { cancelable: true }))).toBe(false);
    expect(calls.confirms).toEqual([]);
    await view.user.click(within(dialog).getByRole('button', { name: 'Discard review' }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/nodes/lnd-lab/payments/new'));
    expect(await screen.findByLabelText(/^Invoice/)).toBeInTheDocument();
    const formSheet = await screen.findByRole('dialog', { name: 'Pay invoice' });
    await view.user.click(within(formSheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/nodes/lnd-lab/payments'));
    expect(view.router.state.location.search).toMatchObject({ sort: 'amount' });
  });

  it('renders a cold-loaded review URL over its list', async () => {
    const created = operation('pay_invoice');
    mockJournal({ created });
    const view = renderApp(`/nodes/lnd-lab/payments/review/${created.id}`);
    expect(await screen.findByRole('heading', { name: 'Payments' })).toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'Pay invoice' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Pay with passkey' })).toBeInTheDocument();
    expect(view.router.state.location.pathname).toBe(`/nodes/lnd-lab/payments/review/${created.id}`);
  });

  it('shows the literal capability reason on the disabled payment palette entry', async () => {
    const node = { ...fixture('node_lnd'), capabilities: { ...fixture('node_lnd').capabilities, pay_invoice: { enabled: false, reason: 'syncing' } } };
    server.use(http.get(api('/nodes/:nodeId'), () => HttpResponse.json(node)));
    const view = renderApp('/nodes/lnd-lab/payments');
    await screen.findByRole('heading', { name: 'Payments' });
    await view.user.keyboard('{Control>}k{/Control}');
    const option = await screen.findByRole('option', { name: /Pay invoice.*The node is syncing\./ });
    expect(option).toHaveAttribute('aria-disabled', 'true');
  });
});
