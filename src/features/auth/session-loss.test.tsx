import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { sessionCsrfToken } from '../../api/csrf';
import { fixture } from '../../test/fixtures';
import { mockJournal, operation } from '../../test/operation-journal';
import { setWideLayout } from '../../test/environment';
import { renderApp } from '../../test/render-app';
import { api, safeError, server } from '../../test/server';
import { assertion } from '../../test/webauthn-mock';

const webauthn = vi.hoisted(() => ({ startAuthentication: vi.fn(), startRegistration: vi.fn() }));
vi.mock('@simplewebauthn/browser', async (importOriginal) =>
  (await import('../../test/webauthn-mock')).webauthnModule(importOriginal, webauthn),
);

type View = ReturnType<typeof renderApp>;

const FIRST_SESSION_CSRF = fixture('session').csrf_token;
const SECOND_SESSION_CSRF = 'SYNTHETIC_SECOND_SESSION_CSRF';
const SESSION_ENDED = safeError('session_required', 'Session ended.', 'not_dispatched');
const MALFORMED_401 = { error: { code: 'not_a_contract_code', message: 'Nope.' } };

const unauthorized: Record<string, () => Response> = {
  'a valid 401 error body': () => HttpResponse.json(SESSION_ENDED, { status: 401 }),
  'a malformed 401 error body': () => HttpResponse.json(MALFORMED_401, { status: 401 }),
  'a non-JSON 401 body': () => new HttpResponse('Unauthorized', { status: 401, headers: { 'Content-Type': 'text/plain' } }),
};

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function cachedNodeReads(view: View) {
  return view.queryClient.getQueryCache().findAll({ queryKey: ['node'] });
}

async function expectSignedOut(view: View) {
  await waitFor(() => expect(view.router.state.location.pathname).toBe('/login'));
  expect(cachedNodeReads(view)).toEqual([]);
  expect(sessionCsrfToken()).toBeNull();
  expect(screen.queryByText('Open the review')).not.toBeInTheDocument();
}

/** The form only creates the review. */
async function createInvoice(view: View) {
  await view.user.type(await screen.findByLabelText(/^Amount \(sat\)/), '2500');
  await view.user.click(screen.getByRole('button', { name: 'Review invoice' }));
}

/** The low-risk confirm is the one explicit action on the invoice review. */
async function createAndConfirmInvoice(view: View) {
  await createInvoice(view);
  await view.user.click(await screen.findByRole('button', { name: 'Create invoice' }));
}

describe('a 401 ends the current session wherever it arrives', () => {
  it.each(Object.keys(unauthorized))('signs out when the low-risk confirm answers with %s', async (label) => {
    const calls = mockJournal({ created: operation('create_invoice'), confirm: unauthorized[label] });
    const view = renderApp('/nodes/lnd-lab/invoices/new');

    await createAndConfirmInvoice(view);

    await expectSignedOut(view);
    expect(calls.creates).toHaveLength(1);
    expect(calls.confirms).toHaveLength(1);
  });

  it.each(Object.keys(unauthorized))('signs out when a passkey-confirmed payment answers with %s', async (label) => {
    webauthn.startAuthentication.mockResolvedValue(assertion);
    const calls = mockJournal({ created: operation('pay_invoice'), confirm: unauthorized[label] });
    const view = renderApp(`/nodes/lnd-lab/operations/${operation('pay_invoice').id}`);

    await view.user.click(await screen.findByRole('button', { name: 'Pay with passkey' }));

    await expectSignedOut(view);
    expect(calls.confirms).toHaveLength(1);
    expect(screen.queryByText('No answer to the confirmation')).not.toBeInTheDocument();
  });

  it.each(Object.keys(unauthorized))('signs out when a node read answers with %s', async (label) => {
    const view = renderApp('/nodes/lnd-lab');
    expect(await screen.findByText('500,000.123 sat')).toBeInTheDocument();

    server.use(http.get(api('/nodes/:nodeId/balances'), unauthorized[label]));
    await view.queryClient.refetchQueries({ queryKey: ['node', 'lnd-lab', 'balances'] });

    await expectSignedOut(view);
  });

  it('keeps showing a definite non-auth confirm error on the review, signed in', async () => {
    const calls = mockJournal({
      created: operation('create_invoice'),
      confirm: () =>
        HttpResponse.json(safeError('resource_busy', 'Another operation holds this resource.', 'not_dispatched'), {
          status: 409,
        }),
    });
    const view = renderApp('/nodes/lnd-lab/invoices/new');

    await createAndConfirmInvoice(view);

    expect(await screen.findByText('Another operation holds this resource.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Review invoice' })).toBeInTheDocument();
    expect(view.router.state.location.pathname).toBe(`/nodes/lnd-lab/invoices/review/${operation('create_invoice').id}`);
    expect(sessionCsrfToken()).toBe(FIRST_SESSION_CSRF);
    expect(calls.confirms).toHaveLength(1);
  });
});

describe('a 401 from a previous session', () => {
  it('does not sign out a newer session or clear its data', async () => {
    webauthn.startAuthentication.mockResolvedValue(assertion);
    let secondSession = false;
    const createGate = deferred<void>();
    server.use(
      http.post(api('/nodes/:nodeId/operations'), async () => {
        await createGate.promise;
        return HttpResponse.json(SESSION_ENDED, { status: 401 });
      }),
      http.delete(api('/session'), () => new HttpResponse(null, { status: 204 })),
      http.get(api('/session'), () =>
        HttpResponse.json(secondSession ? { ...fixture('session'), csrf_token: SECOND_SESSION_CSRF } : fixture('session')),
      ),
      http.post(api('/auth/passkey/start'), () => HttpResponse.json(fixture('login_challenge'))),
      http.post(api('/auth/passkey/finish'), () => {
        secondSession = true;
        return HttpResponse.json({ ...fixture('session'), csrf_token: SECOND_SESSION_CSRF });
      }),
    );
    // Desktop: the sidebar's Sign out sits beside the in-flight form (on a phone it is under More).
    setWideLayout(true);
    const view = renderApp('/nodes/lnd-lab/invoices/new');
    await createInvoice(view);
    const staleMutation = view.queryClient.getMutationCache().getAll().at(-1);
    if (!staleMutation) throw new Error('No mutation was started');

    await view.user.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/login'));
    await view.user.click(await screen.findByRole('button', { name: 'Continue with passkey' }));
    // Sign-in lands on `/`, which opens the remembered node.
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/nodes/lnd-lab'));
    expect(await screen.findByText('500,000.123 sat')).toBeInTheDocument();
    expect(sessionCsrfToken()).toBe(SECOND_SESSION_CSRF);

    createGate.resolve();
    await waitFor(() => expect(staleMutation.state.status).toBe('error'));

    expect(view.router.state.location.pathname).toBe('/nodes/lnd-lab');
    expect(sessionCsrfToken()).toBe(SECOND_SESSION_CSRF);
    expect(cachedNodeReads(view).length).toBeGreaterThan(0);
    expect(screen.getByText('500,000.123 sat')).toBeInTheDocument();
  });
});
