import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { nodeKeys } from '../../api/node-queries';
import { booleanParam, moneySearch, operationIdParam } from '../../app/search';
import { fixture } from '../../test/fixtures';
import { mockJournal, operation } from '../../test/operation-journal';
import { renderApp } from '../../test/render-app';
import { api, readOnlyNode, server } from '../../test/server';

describe('global money actions', () => {
  it('validates the shared boolean and operation-id codecs and resolves one surface', () => {
    expect([undefined, false, 0, 'true', '0', true].map(booleanParam)).toEqual(Array(6).fill(undefined));
    expect(booleanParam('1')).toBe(1);
    expect(booleanParam(1)).toBe(1);
    expect(operationIdParam('../operation')).toBeUndefined();
    expect(operationIdParam('')).toBeUndefined();
    const id = operation('pay_invoice').id;
    expect(moneySearch({ send: 1, receive: 1, operation: id })).toMatchObject({ operation: id, send: undefined, receive: undefined });
    expect(moneySearch({ send: 1, action: 'new_address' }).action).toBeUndefined();
  });

  it('pushes and pops the sheet URL without replacing the screen, including Forward', async () => {
    const view = renderApp('/nodes/lnd-lab/payments?status=succeeded&sort=amount');
    await view.user.click(await screen.findByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('dialog', { name: 'Send' })).toBeInTheDocument();
    expect(view.history.location.pathname).toBe('/nodes/lnd-lab/payments');
    expect(view.history.location.search).toContain('status=succeeded');
    expect(view.history.location.search).toContain('send=1');
    expect(screen.getByRole('heading', { name: 'Payments', hidden: true })).toBeInTheDocument();
    await view.user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(view.history.location.search).not.toContain('send');
    view.history.forward();
    expect(await screen.findByRole('dialog', { name: 'Send' })).toBeInTheDocument();
  });

  it.each([
    ['send', 'Send', ['Pay invoice', 'Send on-chain']],
    ['receive', 'Receive', ['Create invoice', 'New address']],
  ] as const)('cold-loads %s and shows the literal capability reasons', async (parameter, title, entries) => {
    const view = renderApp(`/nodes/${readOnlyNode.id}?${parameter}=1`);
    const dialog = await screen.findByRole('dialog', { name: title });
    for (const label of entries) {
      const entry = within(dialog).getByRole('button', { name: label });
      expect(entry).toBeDisabled();
      expect(entry).toHaveAccessibleDescription('This node is read-only.');
    }
    await view.user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(view.history.location.pathname).toBe(`/nodes/${readOnlyNode.id}`);
  });

  it('creates the existing review in the same sheet and Back returns to Overview', async () => {
    const created = operation('pay_invoice');
    const calls = mockJournal({ created });
    const view = renderApp('/nodes/lnd-lab');
    await view.user.click(await screen.findByRole('button', { name: 'Send' }));
    await view.user.click(await screen.findByRole('button', { name: 'Pay invoice' }));
    const dialog = await screen.findByRole('dialog', { name: 'Pay invoice' });
    await view.user.type(within(dialog).getByLabelText(/^Invoice/), 'SYNTHETIC_BOLT11_PAYMENT_NOT_PAYABLE');
    await view.user.click(within(dialog).getByRole('button', { name: 'Check invoice' }));
    await view.user.click(await within(dialog).findByRole('button', { name: 'Review payment' }));
    expect(await within(dialog).findByRole('button', { name: 'Pay with passkey' })).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(view.history.location.pathname).toBe('/nodes/lnd-lab');
    expect(view.history.location.search).toBe(`?operation=${created.id}`);
    expect(calls.confirms).toHaveLength(0);
    view.history.back();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(view.history.location.href).toBe('/nodes/lnd-lab');
  });

  it('counts only in-progress operations and updates when an operation settles', async () => {
    const pending = operation('pay_invoice', 'pending', 'submitted');
    const review = operation('new_address');
    let items = [pending, review, operation('send_onchain', 'succeeded', 'reconciling', true), operation('connect_peer', 'failed', 'reconciling')];
    server.use(http.get(api('/nodes/lnd-lab/operations'), () => HttpResponse.json({ ...fixture('operations_page'), node_id: 'lnd-lab', items })));
    const view = renderApp('/nodes/lnd-lab/payments');
    await view.user.click(await screen.findByRole('button', { name: '2 in progress' }));
    const popover = await screen.findByRole('dialog', { name: 'Operations in progress' });
    expect(within(popover).getByRole('link', { name: 'Pay invoice' })).toHaveAttribute('href', `/nodes/lnd-lab/operations/${pending.id}`);
    expect(within(popover).getByText('Pending')).toBeInTheDocument();
    expect(within(popover).getByText('Awaiting confirmation')).toBeInTheDocument();
    expect(view.history.location.href).toBe('/nodes/lnd-lab/payments');
    view.queryClient.setQueryData(nodeKeys.operation('lnd-lab', pending.id), pending);
    items = [review];
    view.queryClient.setQueryData(nodeKeys.operation('lnd-lab', pending.id), { ...pending, state: 'succeeded', stage: 'settled', result: fixture('pay_invoice_result') });
    expect(await screen.findByRole('button', { name: '1 in progress' })).toBeInTheDocument();
    expect(within(popover).queryByText('Pending')).not.toBeInTheDocument();
  });

  it.each(['/fleet', '/more'])('disables actions without a node on %s and never reads operations', async (path) => {
    let reads = 0;
    server.use(http.get(api('/nodes/:nodeId/operations'), () => { reads++; return HttpResponse.json(fixture('operations_page')); }));
    renderApp(path);
    const send = await screen.findByRole('button', { name: 'Send' });
    expect(send).toBeDisabled();
    expect(send).toHaveAccessibleDescription('Select a node.');
    expect(screen.getByRole('button', { name: 'Receive' })).toBeDisabled();
    expect(reads).toBe(0);
  });

  it.each(['/nodes/lnd-lab?send=1&receive=1', '/nodes/lnd-lab/payments/new?send=1'])('resolves conflicting cold-load sheet state to one sheet at %s', async (path) => {
    renderApp(path);
    expect(await screen.findByRole('dialog', { name: 'Send' })).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('keeps monitor-only entries visible with their literal reason', async () => {
    renderApp('/nodes/bitcoin-lab?receive=1');
    const dialog = await screen.findByRole('dialog', { name: 'Receive' });
    for (const label of ['Create invoice', 'New address']) {
      const entry = within(dialog).getByRole('button', { name: label });
      expect(entry).toBeDisabled();
      expect(entry).toHaveAccessibleDescription('This node is monitor only.');
    }
  });
});
