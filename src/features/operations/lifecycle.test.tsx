import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { nodeKeys } from '../../api/node-queries';
import { fixture } from '../../test/fixtures';
import { mockJournal, operation } from '../../test/operation-journal';
import { renderApp } from '../../test/render-app';
import { api, safeError, server } from '../../test/server';
import { assertion } from '../../test/webauthn-mock';

const webauthn = vi.hoisted(() => ({ startAuthentication: vi.fn(), startRegistration: vi.fn() }));
vi.mock('@simplewebauthn/browser', async (importOriginal) =>
  (await import('../../test/webauthn-mock')).webauthnModule(importOriginal, webauthn),
);

const PAY_ID = operation('pay_invoice').id;

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

type View = ReturnType<typeof renderApp>;

/** The mutation the last click started; it keeps its own state after a cache clear. */
function lastMutation(view: View) {
  const mutation = view.queryClient.getMutationCache().getAll().at(-1);
  if (!mutation) throw new Error('No mutation was started');
  return mutation;
}

async function settled(mutation: ReturnType<typeof lastMutation>) {
  await waitFor(() => expect(mutation.state.status).not.toBe('pending'));
}

async function switchToClnLab(view: View) {
  await view.user.click(screen.getByRole('combobox', { name: 'Node' }));
  await view.user.click(await screen.findByRole('option', { name: /CLN lab/ }));
  await waitFor(() => expect(view.router.state.location.pathname).toBe('/nodes/cln-lab'));
}

async function loseSession(view: View) {
  server.use(
    http.get(api('/nodes/:nodeId'), () => HttpResponse.json(safeError('session_required', 'Sign in.'), { status: 401 })),
    http.get(api('/session'), () => HttpResponse.json(safeError('session_required', 'Sign in.'), { status: 401 })),
  );
  await view.queryClient.refetchQueries({ type: 'active' });
  await waitFor(() => expect(view.router.state.location.pathname).toBe('/login'));
}

function cachedNodeReads(view: View) {
  return view.queryClient.getQueryCache().findAll({ queryKey: ['node'] });
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
    const view = renderApp(`/nodes/lnd-lab/operations/${PAY_ID}`);
    await view.user.click(await screen.findByRole('button', { name: 'Pay with passkey' }));
    const mutation = lastMutation(view);

    await switchToClnLab(view);
    authorizeGate.resolve();
    await settled(mutation);

    expect(mutation.state.status).toBe('error');
    expect(webauthn.startAuthentication).not.toHaveBeenCalled();
    expect(calls.finishes).toEqual([]);
    expect(calls.confirms).toEqual([]);
    expect(view.router.state.location.pathname).toBe('/nodes/cln-lab');
  });

  it('abandons the attempt when the review is left while the passkey prompt is open', async () => {
    const passkey = deferred<typeof assertion>();
    webauthn.startAuthentication.mockReturnValue(passkey.promise);
    const calls = mockJournal({ created: operation('pay_invoice') });
    const view = renderApp(`/nodes/lnd-lab/operations/${PAY_ID}`);
    await view.user.click(await screen.findByRole('button', { name: 'Pay with passkey' }));
    await waitFor(() => expect(webauthn.startAuthentication).toHaveBeenCalledTimes(1));
    const mutation = lastMutation(view);

    await view.router.navigate({ to: '/nodes/$nodeId/payments', params: { nodeId: 'lnd-lab' } });
    passkey.resolve(assertion);
    await settled(mutation);

    expect(mutation.state.status).toBe('error');
    expect(calls.finishes).toEqual([]);
    expect(calls.confirms).toEqual([]);
    expect(view.router.state.location.pathname).toBe('/nodes/lnd-lab/payments');
  });

  it('abandons the attempt when the session is lost while the passkey prompt is open', async () => {
    const passkey = deferred<typeof assertion>();
    webauthn.startAuthentication.mockReturnValue(passkey.promise);
    const calls = mockJournal({ created: operation('pay_invoice') });
    const view = renderApp(`/nodes/lnd-lab/operations/${PAY_ID}`);
    await view.user.click(await screen.findByRole('button', { name: 'Pay with passkey' }));
    await waitFor(() => expect(webauthn.startAuthentication).toHaveBeenCalledTimes(1));
    const mutation = lastMutation(view);

    await loseSession(view);
    passkey.resolve(assertion);
    await settled(mutation);

    expect(mutation.state.status).toBe('error');
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
    const mutation = lastMutation(view);

    await view.router.navigate({ to: '/nodes/$nodeId/payments', params: { nodeId: 'lnd-lab' } });
    createGate.resolve();
    await settled(mutation);

    expect(mutation.state.status).toBe('error');
    expect(calls.confirms).toEqual([]);
    expect(view.router.state.location.pathname).toBe('/nodes/lnd-lab/payments');
  });

  it('still confirms an active review the operator explicitly confirms', async () => {
    webauthn.startAuthentication.mockResolvedValue(assertion);
    const calls = mockJournal({ created: operation('pay_invoice') });
    const view = renderApp(`/nodes/lnd-lab/operations/${PAY_ID}`);

    await view.user.click(await screen.findByRole('button', { name: 'Pay with passkey' }));

    await screen.findByText('In flight. The node has not reported a final outcome.');
    expect(calls.confirms).toHaveLength(1);
  });
});

describe('late answers after the session ends', () => {
  it('keeps the cleared cache empty when a payment review created before sign-out answers late', async () => {
    const calls = mockJournal({ created: operation('pay_invoice') });
    const createGate = deferred<void>();
    server.use(
      http.post(api('/nodes/:nodeId/operations'), async () => {
        await createGate.promise;
        return HttpResponse.json(operation('pay_invoice'), { status: 201 });
      }),
    );
    const view = renderApp('/nodes/lnd-lab/payments/new');
    await view.user.type(await screen.findByLabelText(/^Lightning invoice/), 'SYNTHETIC_BOLT11_PAYMENT_NOT_PAYABLE');
    await view.user.click(screen.getByRole('button', { name: 'Decode' }));
    await view.user.click(await screen.findByRole('button', { name: 'Review payment' }));
    const mutation = lastMutation(view);

    await loseSession(view);
    expect(cachedNodeReads(view)).toEqual([]);
    createGate.resolve();
    await settled(mutation);

    expect(mutation.state.status).toBe('success');
    expect(view.queryClient.getQueryData(nodeKeys.operation('lnd-lab', PAY_ID))).toBeUndefined();
    expect(cachedNodeReads(view)).toEqual([]);
    expect(calls.authorizes).toEqual([]);
    expect(calls.confirms).toEqual([]);
    expect(view.router.state.location.pathname).toBe('/login');
  });

  it('keeps the cleared cache empty when an already sent confirmation answers after sign-out', async () => {
    webauthn.startAuthentication.mockResolvedValue(assertion);
    const confirmGate = deferred<void>();
    const calls = mockJournal({
      created: operation('pay_invoice'),
      confirm: () => HttpResponse.json({ ...operation('pay_invoice'), state: 'pending', stage: 'submitted' }, { status: 202 }),
    });
    server.use(
      http.post(api('/nodes/:nodeId/operations/:operationId/confirm'), async ({ request, params }) => {
        calls.confirms.push({ nodeId: String(params.nodeId), operationId: String(params.operationId), body: await request.json() });
        await confirmGate.promise;
        return HttpResponse.json({ ...operation('pay_invoice'), state: 'pending', stage: 'submitted' }, { status: 202 });
      }),
    );
    const view = renderApp(`/nodes/lnd-lab/operations/${PAY_ID}`);
    await view.user.click(await screen.findByRole('button', { name: 'Pay with passkey' }));
    await waitFor(() => expect(calls.confirms).toHaveLength(1));
    const mutation = lastMutation(view);

    await loseSession(view);
    confirmGate.resolve();
    await settled(mutation);

    expect(mutation.state.status).toBe('success');
    expect(view.queryClient.getQueryData(nodeKeys.operation('lnd-lab', PAY_ID))).toBeUndefined();
    expect(cachedNodeReads(view)).toEqual([]);
    expect(calls.confirms).toHaveLength(1);
    expect(view.router.state.location.pathname).toBe('/login');
  });
});
