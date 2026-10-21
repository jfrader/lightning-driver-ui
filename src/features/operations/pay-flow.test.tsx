import { screen, waitFor } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixture } from '../../test/fixtures';
import { mockJournal, operation } from '../../test/operation-journal';
import { openTechnicalDetails } from '../../test/queries';
import { renderApp } from '../../test/render-app';
import { api, safeError, server } from '../../test/server';
import { assertion, canceledPasskey } from '../../test/webauthn-mock';

const webauthn = vi.hoisted(() => ({ startAuthentication: vi.fn(), startRegistration: vi.fn() }));
vi.mock('@simplewebauthn/browser', async (importOriginal) =>
  (await import('../../test/webauthn-mock')).webauthnModule(importOriginal, webauthn),
);

const BOLT11 = 'SYNTHETIC_BOLT11_PAYMENT_NOT_PAYABLE';
const review = () => operation('pay_invoice');
const OPERATION_ID = review().id;
const DIGEST = review().review.digest;

afterEach(() => onlineManager.setOnline(true));

async function reviewPayment(view: ReturnType<typeof renderApp>, clicks = 1) {
  const { user } = view;
  await user.type(await screen.findByLabelText(/Lightning invoice/), BOLT11);
  await user.click(screen.getByRole('button', { name: 'Decode' }));
  const reviewButton = await screen.findByRole('button', { name: 'Review payment' });
  if (clicks === 2) await user.dblClick(reviewButton);
  else await user.click(reviewButton);
}

describe('pay invoice', () => {
  it('decodes, creates one server review and renders the server values, not the form', async () => {
    const created = review();
    created.review.amount_msat = '2500001';
    const calls = mockJournal({ created });
    const view = renderApp('/nodes/lnd-lab/payments/new');

    await reviewPayment(view);

    expect(await screen.findByRole('button', { name: 'Pay with passkey' })).toBeInTheDocument();
    expect(view.router.state.location.pathname).toBe(`/nodes/lnd-lab/operations/${OPERATION_ID}`);
    expect(screen.getByRole('heading', { name: 'Review payment' })).toBeInTheDocument();
    expect(screen.getByText('Pay Lightning invoice').nextElementSibling).toHaveTextContent('2,500.001 sat');
    expect(screen.getByText('From').nextElementSibling).toHaveTextContent('Regtest');
    expect(screen.getByText('From').nextElementSibling).toHaveTextContent('lnd-lab');
    await openTechnicalDetails(view.user);
    expect(screen.getByText('Review digest').nextElementSibling).toHaveTextContent(DIGEST);
    expect(calls.creates).toEqual([
      {
        nodeId: 'lnd-lab',
        key: expect.stringMatching(/^[0-9a-f-]{36}$/),
        body: { kind: 'pay_invoice', params: { bolt11: BOLT11, amount_msat: null, max_fee_msat: '1000', description: null } },
      },
    ]);
    expect(calls.confirms).toEqual([]);
  });

  it('submits a double-clicked review once', async () => {
    const calls = mockJournal({ created: review() });
    const view = renderApp('/nodes/lnd-lab/payments/new');

    await reviewPayment(view, 2);

    await screen.findByRole('button', { name: 'Pay with passkey' });
    expect(calls.creates).toHaveLength(1);
  });

  it('pays only after a passkey step-up bound to the reviewed operation, then follows the status to settled', async () => {
    webauthn.startAuthentication.mockResolvedValue(assertion);
    const calls = mockJournal({ created: review(), reads: [operation('pay_invoice', 'succeeded', 'settled', true)] });
    const view = renderApp('/nodes/lnd-lab/payments/new');
    await reviewPayment(view);

    await view.user.dblClick(await screen.findByRole('button', { name: 'Pay with passkey' }));

    expect(await screen.findByText('This page updates automatically.')).toBeInTheDocument();
    expect(calls.authorizes).toEqual([{ nodeId: 'lnd-lab', operationId: OPERATION_ID, body: { review_digest: DIGEST } }]);
    expect(calls.finishes).toEqual([
      {
        nodeId: 'lnd-lab',
        operationId: OPERATION_ID,
        body: expect.objectContaining({ challenge_id: fixture('strict_authorize_start').challenge.challenge_id, review_digest: DIGEST }),
      },
    ]);
    expect(calls.confirms).toEqual([
      {
        nodeId: 'lnd-lab',
        operationId: OPERATION_ID,
        body: { review_digest: DIGEST, authorization_id: fixture('operation_authorization').authorization_id },
      },
    ]);
    expect(await screen.findByText('Paid', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pay with passkey' })).not.toBeInTheDocument();
  });

  it('uses a server-issued recent-auth grant without a new passkey prompt', async () => {
    const calls = mockJournal({ created: review() });
    const grant = fixture('recent_authorize_start');
    server.use(http.post(api('/nodes/:nodeId/operations/:operationId/authorize'), () => HttpResponse.json(grant)));
    const view = renderApp(`/nodes/lnd-lab/operations/${OPERATION_ID}`);

    await view.user.click(await screen.findByRole('button', { name: 'Pay with passkey' }));

    await screen.findByText('This page updates automatically.');
    expect(webauthn.startAuthentication).not.toHaveBeenCalled();
    expect(calls.confirms.map((call) => call.body)).toEqual([
      { review_digest: DIGEST, authorization_id: 'authorization' in grant ? grant.authorization.authorization_id : null },
    ]);
  });

  it('refuses a grant issued for a different operation', async () => {
    const calls = mockJournal({ created: review() });
    const grant = fixture('recent_authorize_start');
    if ('authorization' in grant) grant.authorization.operation_id = '00000000-0000-4000-8000-000000000999';
    server.use(http.post(api('/nodes/:nodeId/operations/:operationId/authorize'), () => HttpResponse.json(grant)));
    const view = renderApp(`/nodes/lnd-lab/operations/${OPERATION_ID}`);

    await view.user.click(await screen.findByRole('button', { name: 'Pay with passkey' }));

    expect(await screen.findByText('Unexpected response')).toBeInTheDocument();
    expect(calls.confirms).toEqual([]);
  });

  it('keeps the review open and sends nothing when the passkey prompt is canceled', async () => {
    webauthn.startAuthentication.mockRejectedValue(canceledPasskey());
    const calls = mockJournal({ created: review() });
    const view = renderApp(`/nodes/lnd-lab/operations/${OPERATION_ID}`);

    await view.user.click(await screen.findByRole('button', { name: 'Pay with passkey' }));

    expect(await screen.findByText('Passkey request canceled. Nothing was sent.')).toBeInTheDocument();
    expect(calls.confirms).toEqual([]);
    expect(screen.getByRole('button', { name: 'Pay with passkey' })).toBeInTheDocument();
  });

  it.each([
    ['a lost connection', () => HttpResponse.error()],
    [
      'an unknown outcome',
      () => HttpResponse.json(safeError('outcome_unknown', 'Outcome unknown.', 'unknown', OPERATION_ID), { status: 504 }),
    ],
  ])('shows %s after confirm as unresolved, never as a retryable failure, until a read shows success', async (_label, confirm) => {
    webauthn.startAuthentication.mockResolvedValue(assertion);
    const calls = mockJournal({
      created: review(),
      confirm,
      reads: [review(), review(), operation('pay_invoice', 'unknown', 'reconciling'), operation('pay_invoice', 'succeeded', 'settled', true)],
    });
    const view = renderApp(`/nodes/lnd-lab/operations/${OPERATION_ID}`);

    await view.user.click(await screen.findByRole('button', { name: 'Pay with passkey' }));

    expect(await screen.findByText('No answer to the confirmation')).toBeInTheDocument();
    expect(view.router.state.location.search).toEqual({ confirmation: 'unanswered' });
    for (const name of ['Pay with passkey', 'Try again', 'Retry']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByText('Failed')).not.toBeInTheDocument();
    expect(await screen.findAllByText('Outcome unknown', {}, { timeout: 4000 })).not.toHaveLength(0);
    expect(await screen.findByText('Paid', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(calls.confirms).toHaveLength(1);
  }, 15_000);

  it('fails at once while offline and does not send when the connection returns', async () => {
    let attempts = 0;
    server.use(
      http.post(api('/nodes/:nodeId/operations'), () => {
        attempts += 1;
        return HttpResponse.error();
      }),
    );
    const view = renderApp('/nodes/lnd-lab/payments/new');
    await view.user.type(await screen.findByLabelText(/Lightning invoice/), BOLT11);
    await view.user.click(screen.getByRole('button', { name: 'Decode' }));
    await screen.findByRole('button', { name: 'Review payment' });

    onlineManager.setOnline(false);
    await view.user.click(screen.getByRole('button', { name: 'Review payment' }));

    expect(await screen.findByText('The server could not be reached.')).toBeInTheDocument();
    expect(attempts).toBe(1);
    onlineManager.setOnline(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(attempts).toBe(1);
    expect(view.router.state.location.pathname).toBe('/nodes/lnd-lab/payments/new');
  });
});

describe('review binding', () => {
  it('does not carry a review to another node when switching, and confirms only on its own node', async () => {
    webauthn.startAuthentication.mockResolvedValue(assertion);
    const calls = mockJournal({ created: review() });
    const view = renderApp(`/nodes/lnd-lab/operations/${OPERATION_ID}`);
    await screen.findByRole('button', { name: 'Pay with passkey' });

    await view.user.click(screen.getByRole('combobox', { name: 'Node' }));
    await view.user.click(await screen.findByRole('option', { name: /CLN lab/ }));

    await waitFor(() => expect(view.router.state.location.pathname).toBe('/nodes/cln-lab'));
    expect(screen.queryByRole('button', { name: 'Pay with passkey' })).not.toBeInTheDocument();

    view.history.back();
    await view.user.click(await screen.findByRole('button', { name: 'Pay with passkey' }));
    await screen.findByText('This page updates automatically.');
    expect(calls.confirms.map((call) => call.nodeId)).toEqual(['lnd-lab']);
    expect(calls.authorizes.map((call) => call.nodeId)).toEqual(['lnd-lab']);
  });

  it('refuses an operation the server reports for another node', async () => {
    const foreign = review();
    foreign.node_id = 'cln-lab';
    foreign.review.node.node_id = 'cln-lab';
    mockJournal({ created: foreign });
    renderApp(`/nodes/lnd-lab/operations/${OPERATION_ID}`);

    expect(await screen.findByText('Unexpected response')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pay with passkey' })).not.toBeInTheDocument();
  });

  it('blocks confirmation when the node identity changed after the review', async () => {
    const stale = review();
    stale.review.node.identity_revision = 'synthetic-lnd-binding-0';
    const calls = mockJournal({ created: stale });
    renderApp(`/nodes/lnd-lab/operations/${OPERATION_ID}`);

    expect(await screen.findByText('The node identity or network changed after this review.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pay with passkey' })).not.toBeInTheDocument();
    expect(calls.authorizes).toEqual([]);
  });

  it('blocks confirmation of an expired review', async () => {
    vi.setSystemTime(new Date('2026-10-21T12:06:00Z'));
    mockJournal({ created: review() });
    renderApp(`/nodes/lnd-lab/operations/${OPERATION_ID}`);

    expect(await screen.findByText('This review expired.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pay with passkey' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start a new review' })).toHaveAttribute('href', '/nodes/lnd-lab/payments/new');
  });
});
