import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, beforeEach, expect, it, vi } from 'vitest';
import { fixture } from '../../../test/fixtures';
import { setWideLayout } from '../../../test/environment';
import { mockJournal, operation } from '../../../test/operation-journal';
import { openTechnicalDetails } from '../../../test/queries';
import { renderApp } from '../../../test/render-app';
import { api, safeError, server } from '../../../test/server';
import { assertion } from '../../../test/webauthn-mock';

const webauthn = vi.hoisted(() => ({ startAuthentication: vi.fn(), startRegistration: vi.fn() }));
vi.mock('@simplewebauthn/browser', async (importOriginal) =>
  (await import('../../../test/webauthn-mock')).webauthnModule(importOriginal, webauthn),
);

const review = () => operation('pay_invoice');
const PATH = `/nodes/lnd-lab/operations/${review().id}`;
const RECIPIENT = review().review.destination ?? '';

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('payment review', () => {
  beforeEach(() => {
    // Discard only exists beside the primary action on desktop; the phone back link discards.
    setWideLayout(true);
  });

  it('shows what the passkey approves from the server review', async () => {
    mockJournal({ created: review() });
    const { user } = renderApp(PATH);

    expect(await screen.findByRole('button', { name: 'Pay with passkey' })).toBeInTheDocument();
    expect(screen.getByText('Not sent')).toBeInTheDocument();
    expect(screen.getByText(/^expires/)).toHaveTextContent('expires 12:05:00 UTC');
    expect(screen.getByText('Pay Lightning invoice').nextElementSibling).toHaveTextContent('2,500 sat');
    expect(screen.getByText('Hard cap')).toBeInTheDocument();
    expect(screen.getByText('at most 0.04% of amount')).toBeInTheDocument();
    expect(screen.getByText('Total').nextElementSibling).toHaveTextContent('at most 2,501 sat');
    expect(screen.getByTitle(RECIPIENT)).toHaveTextContent(RECIPIENT);
    expect(screen.getByText('Description').nextElementSibling).toHaveTextContent('Synthetic payment');
    expect(screen.getByRole('link', { name: 'Discard review' })).toHaveAttribute('href', '/nodes/lnd-lab/payments/new');

    await openTechnicalDetails(user);
    expect(screen.getByText('Invoice expires').nextElementSibling).toHaveTextContent('13:00:00');
  });

  it('takes the description from the request when the operation carries one', async () => {
    const withDescription = review();
    Object.assign(withDescription.request.params, { description: 'Reviewed text from the request' });
    mockJournal({ created: withDescription });
    renderApp(PATH);
    await screen.findByRole('button', { name: 'Pay with passkey' });
    expect(screen.getByText('Description').nextElementSibling).toHaveTextContent('Reviewed text from the request');
  });

  it.each([
    ['decodes to another payment hash', () => HttpResponse.json({ ...fixture('decode'), payment_hash: 'f'.repeat(64) })],
    ['cannot be decoded', () => HttpResponse.json(safeError('invalid_invoice', 'Invalid invoice.'), { status: 422 })],
  ])('offers no confirmation when the invoice %s', async (_label, decode) => {
    const calls = mockJournal({ created: review() });
    server.use(http.post(api('/nodes/:nodeId/decode'), decode));
    renderApp(PATH);

    expect(await screen.findByText('The invoice could not be checked again.')).toBeInTheDocument();
    expect(screen.getByText('Nothing was sent.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pay with passkey' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Discard review' })).toBeInTheDocument();
    expect(calls.authorizes).toEqual([]);
  });

  it('is never autofocused and no key outside the button authorizes', async () => {
    const calls = mockJournal({ created: review() });
    const { user } = renderApp(PATH);
    const pay = await screen.findByRole('button', { name: 'Pay with passkey' });

    expect(pay).not.toHaveFocus();
    await user.keyboard('{Enter}{Control>}{Enter}{/Control}{Meta>}{Enter}{/Meta} ');
    expect(calls.authorizes).toEqual([]);
    expect(calls.confirms).toEqual([]);
  });
});

describe('node switching during a confirmation', () => {
  it('locks the node chooser from the sent confirm until it answers', async () => {
    webauthn.startAuthentication.mockResolvedValue(assertion);
    const gate = deferred();
    const calls = mockJournal({ created: review() });
    server.use(
      http.post(api('/nodes/:nodeId/operations/:operationId/confirm'), async () => {
        calls.confirms.push({ nodeId: 'lnd-lab', operationId: review().id, body: null });
        await gate.promise;
        return HttpResponse.json({ ...review(), state: 'pending', stage: 'submitted' }, { status: 202 });
      }),
    );
    const { user } = renderApp(PATH);
    const chooser = await screen.findByRole('combobox', { name: 'Node' });
    expect(chooser).toBeEnabled();

    await user.click(await screen.findByRole('button', { name: 'Pay with passkey' }));

    await waitFor(() => expect(calls.confirms).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Node' })).toBeDisabled());
    expect(screen.getByText('Sending…')).toBeInTheDocument();

    gate.resolve();
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Node' })).toBeEnabled());
    expect(screen.queryByText('Sending…')).not.toBeInTheDocument();
  });
});
