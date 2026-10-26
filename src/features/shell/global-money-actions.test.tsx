import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { nodeKeys } from '../../api/node-queries';
import { booleanParam, moneySearch, operationIdParam } from '../../app/search';
import { fixture } from '../../test/fixtures';
import { mockJournal, operation } from '../../test/operation-journal';
import { renderApp } from '../../test/render-app';
import { api, readOnlyNode, server } from '../../test/server';
import { assertion } from '../../test/webauthn-mock';

const webauthn = vi.hoisted(() => ({ startAuthentication: vi.fn(), startRegistration: vi.fn() }));
vi.mock('@simplewebauthn/browser', async (importOriginal) =>
  (await import('../../test/webauthn-mock')).webauthnModule(importOriginal, webauthn),
);

describe('global money actions', () => {
  it('validates the shared codecs and preserves action deep links', () => {
    expect([undefined, false, 0, 'true', '0', true].map(booleanParam)).toEqual(Array(6).fill(undefined));
    expect(booleanParam('1')).toBe(1);
    expect(operationIdParam('../operation')).toBeUndefined();
    const id = operation('pay_invoice').id;
    expect(moneySearch({ send: 1, receive: 1, operation: id })).toMatchObject({ operation: id, send: undefined, receive: undefined });
    expect(moneySearch({ send: 1, action: 'new_address' }).action).toBeUndefined();
    expect(moneySearch({ receive: 1, action: 'new_address' }).action).toBe('new_address');
  });

  it('opens the grouped menu on the existing screen, closes and reopens with Forward', async () => {
    const view = renderApp('/nodes/lnd-lab/payments?status=succeeded&sort=amount');
    await view.user.click(await screen.findByRole('button', { name: 'Send and receive' }));
    const menu = await screen.findByRole('menu', { name: 'Send and receive' });
    expect(within(menu).getByRole('group', { name: 'Send' })).toBeInTheDocument();
    expect(within(menu).getByRole('group', { name: 'Receive' })).toBeInTheDocument();
    expect(within(menu).getAllByRole('menuitem').filter((item) => item.tabIndex === 0)).toHaveLength(1);
    expect(within(menu).getByRole('menuitem', { name: 'Pay invoice' })).toHaveAttribute('data-autofocus');
    expect(view.history.location.search).toContain('status=succeeded');
    expect(view.history.location.search).toContain('send=1');
    await view.user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    view.history.forward();
    expect(await screen.findByRole('menu')).toBeInTheDocument();
  });

  it.each(['send', 'receive'])('cold-loads %s and shows literal capability reasons in both groups', async (parameter) => {
    renderApp(`/nodes/${readOnlyNode.id}?${parameter}=1`);
    const menu = await screen.findByRole('menu');
    for (const entry of within(menu).getAllByRole('menuitem')) {
      expect(entry).toBeDisabled();
      expect(entry).toHaveAccessibleDescription('This node is read-only.');
      expect(entry.tabIndex).toBe(-1);
    }
  });

  it('creates the existing review sheet without confirming and Back returns to Overview', async () => {
    const created = operation('pay_invoice');
    const calls = mockJournal({ created });
    const view = renderApp('/nodes/lnd-lab');
    await view.user.click(await screen.findByRole('button', { name: 'Send and receive' }));
    await view.user.click(await screen.findByRole('menuitem', { name: 'Pay invoice' }));
    const dialog = await screen.findByRole('dialog', { name: 'Send and receive' });
    await view.user.type(await within(dialog).findByLabelText(/^Invoice/), 'SYNTHETIC_BOLT11_PAYMENT_NOT_PAYABLE');
    await view.user.click(within(dialog).getByRole('button', { name: 'Check invoice' }));
    await view.user.click(await within(dialog).findByRole('button', { name: 'Review payment' }));
    expect(await screen.findByRole('button', { name: 'Pay with passkey' })).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(view.history.location.search).toBe(`?operation=${created.id}`);
    expect(calls.confirms).toHaveLength(0);
    view.history.back();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(view.history.location.href).toBe('/nodes/lnd-lab');
  });

  it('deduplicates unresolved and in-progress operation ids and hides the pill at zero', async () => {
    const pending = operation('pay_invoice', 'pending', 'submitted');
    const review = operation('new_address');
    let items = [pending, pending, review, operation('send_onchain', 'succeeded', 'reconciling', true), operation('connect_peer', 'failed', 'reconciling')];
    server.use(http.get(api('/nodes/lnd-lab/operations'), () => HttpResponse.json({ ...fixture('operations_page'), node_id: 'lnd-lab', items })));
    const view = renderApp('/nodes/lnd-lab/payments');
    await view.user.click(await screen.findByRole('button', { name: 'Operations: 2' }));
    const popover = await screen.findByRole('dialog', { name: 'Operations' });
    expect(within(popover).getAllByRole('link', { name: 'Pay invoice' })).toHaveLength(1);
    view.queryClient.setQueryData(nodeKeys.operation('lnd-lab', pending.id), pending);
    items = [review];
    view.queryClient.setQueryData(nodeKeys.operation('lnd-lab', pending.id), { ...pending, state: 'succeeded', stage: 'settled', result: fixture('pay_invoice_result') });
    expect(await screen.findByRole('button', { name: 'Operations: 1' })).toBeInTheDocument();
    items = [];
    await view.queryClient.invalidateQueries({ queryKey: nodeKeys.all('lnd-lab') });
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Operations:/ })).not.toBeInTheDocument());
  });

  it('leaves an unanswered confirmation in the operation view even while the journal still awaits confirmation', async () => {
    webauthn.startAuthentication.mockResolvedValue(assertion);
    const created = operation('pay_invoice');
    const calls = mockJournal({ created, confirm: () => HttpResponse.error() });
    const view = renderApp(`/nodes/lnd-lab?operation=${created.id}`);
    await view.user.click(await screen.findByRole('button', { name: 'Pay with passkey' }));
    expect(await screen.findByRole('heading', { name: 'Payment operation' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Review payment' })).not.toBeInTheDocument();
    expect(view.history.location.search).toBe(`?operation=${created.id}&confirmation=unanswered`);
    expect(calls.confirms).toHaveLength(1);
  });

  it.each(['send', 'receive'])('returns from a %s form to its menu without changing mode', async (mode) => {
    const action = mode === 'send' ? 'pay_invoice' : 'new_address';
    const view = renderApp(`/nodes/lnd-lab?${mode}=1&action=${action}`);
    await view.user.click(await screen.findByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    expect(view.history.location.search).toBe(`?${mode}=1`);
  });

  it.each(['/fleet', '/more'])('disables the single control without a node on %s', async (path) => {
    let reads = 0;
    server.use(http.get(api('/nodes/:nodeId/operations'), () => { reads++; return HttpResponse.json(fixture('operations_page')); }));
    renderApp(path);
    const trigger = await screen.findByRole('button', { name: 'Send and receive' });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAccessibleDescription('Select a node.');
    expect(reads).toBe(0);
  });

  it('keeps monitor-only menu entries visible with their reason', async () => {
    renderApp('/nodes/bitcoin-lab?receive=1');
    const menu = await screen.findByRole('menu');
    for (const entry of within(menu).getAllByRole('menuitem')) {
      expect(entry).toBeDisabled();
      expect(entry).toHaveAccessibleDescription('This node is monitor only.');
    }
  });
});
