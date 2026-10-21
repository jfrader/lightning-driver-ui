import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { fixture } from '../../test/fixtures';
import { mockJournal, operation } from '../../test/operation-journal';
import { renderApp } from '../../test/render-app';
import { api, safeError, server } from '../../test/server';
import { assertion } from '../../test/webauthn-mock';

const webauthn = vi.hoisted(() => ({ startAuthentication: vi.fn(), startRegistration: vi.fn() }));
vi.mock('@simplewebauthn/browser', async (importOriginal) =>
  (await import('../../test/webauthn-mock')).webauthnModule(importOriginal, webauthn),
);

const OPERATION_ID = operation('pay_invoice').id;
const SETTLE_MS = 300;

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

async function switchToClnLab(view: ReturnType<typeof renderApp>) {
  await view.user.click(screen.getByRole('combobox', { name: 'Node' }));
  await view.user.click(await screen.findByRole('option', { name: /CLN lab/ }));
  await waitFor(() => expect(view.router.state.location.pathname).toBe('/nodes/cln-lab'));
}

describe('leaving a review while its confirmation is in flight', () => {
  it('abandons the attempt when the node is switched while authorization is pending', async () => {
    webauthn.startAuthentication.mockResolvedValue(assertion);
    const calls = mockJournal({ created: operation('pay_invoice') });
    const authorizeGate = deferred<void>();
    server.use(
      http.post(api('/nodes/:nodeId/operations/:operationId/authorize'), async () => {
        await authorizeGate.promise;
        return HttpResponse.json(fixture('strict_authorize_start'));
      }),
    );
    const view = renderApp(`/nodes/lnd-lab/operations/${OPERATION_ID}`);
    await view.user.click(await screen.findByRole('button', { name: 'Pay with passkey' }));

    await switchToClnLab(view);
    authorizeGate.resolve();
    await settle();

    expect(webauthn.startAuthentication).not.toHaveBeenCalled();
    expect(calls.finishes).toEqual([]);
    expect(calls.confirms).toEqual([]);
    expect(view.router.state.location.pathname).toBe('/nodes/cln-lab');
  });

  it('abandons the attempt when the review is left while the passkey prompt is open', async () => {
    const passkey = deferred<typeof assertion>();
    webauthn.startAuthentication.mockReturnValue(passkey.promise);
    const calls = mockJournal({ created: operation('pay_invoice') });
    const view = renderApp(`/nodes/lnd-lab/operations/${OPERATION_ID}`);
    await view.user.click(await screen.findByRole('button', { name: 'Pay with passkey' }));
    await waitFor(() => expect(webauthn.startAuthentication).toHaveBeenCalledTimes(1));

    await view.router.navigate({ to: '/nodes/$nodeId/payments', params: { nodeId: 'lnd-lab' } });
    passkey.resolve(assertion);
    await settle();

    expect(calls.finishes).toEqual([]);
    expect(calls.confirms).toEqual([]);
    expect(view.router.state.location.pathname).toBe('/nodes/lnd-lab/payments');
  });

  it('abandons the attempt when the session is lost while the passkey prompt is open', async () => {
    const passkey = deferred<typeof assertion>();
    webauthn.startAuthentication.mockReturnValue(passkey.promise);
    const calls = mockJournal({ created: operation('pay_invoice') });
    const view = renderApp(`/nodes/lnd-lab/operations/${OPERATION_ID}`);
    await view.user.click(await screen.findByRole('button', { name: 'Pay with passkey' }));
    await waitFor(() => expect(webauthn.startAuthentication).toHaveBeenCalledTimes(1));

    server.use(
      http.get(api('/nodes/:nodeId'), () => HttpResponse.json(safeError('session_required', 'Sign in.'), { status: 401 })),
      http.get(api('/session'), () => HttpResponse.json(safeError('session_required', 'Sign in.'), { status: 401 })),
    );
    await view.queryClient.refetchQueries({ type: 'active' });
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/login'));
    passkey.resolve(assertion);
    await settle();

    expect(calls.finishes).toEqual([]);
    expect(calls.confirms).toEqual([]);
  });

  it('does not confirm a low-risk review whose form was left while it was being created', async () => {
    const calls = mockJournal({ created: operation('create_invoice') });
    const createGate = deferred<void>();
    server.use(
      http.post(api('/nodes/:nodeId/operations'), async () => {
        await createGate.promise;
        return HttpResponse.json(operation('create_invoice'), { status: 201 });
      }),
    );
    const view = renderApp('/nodes/lnd-lab/invoices/new');
    await view.user.type(await screen.findByLabelText(/^Amount \(sat\)/), '2500');
    await view.user.click(screen.getByRole('button', { name: 'Create invoice' }));

    await view.router.navigate({ to: '/nodes/$nodeId/payments', params: { nodeId: 'lnd-lab' } });
    createGate.resolve();
    await settle();

    expect(calls.confirms).toEqual([]);
    expect(view.router.state.location.pathname).toBe('/nodes/lnd-lab/payments');
  });

  it('still confirms an active review the operator explicitly confirms', async () => {
    webauthn.startAuthentication.mockResolvedValue(assertion);
    const calls = mockJournal({ created: operation('pay_invoice') });
    const view = renderApp(`/nodes/lnd-lab/operations/${OPERATION_ID}`);

    await view.user.click(await screen.findByRole('button', { name: 'Pay with passkey' }));

    await screen.findByText('This page updates automatically.');
    expect(calls.confirms).toHaveLength(1);
  });
});
