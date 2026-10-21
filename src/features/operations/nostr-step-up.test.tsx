import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NostrEventTemplate } from '../../api/types';
import { fixture } from '../../test/fixtures';
import { NOSTR_KEYS, installNostrExtension, nostrChallenge, signedEvent } from '../../test/nostr';
import { mockJournal, operation } from '../../test/operation-journal';
import { renderApp } from '../../test/render-app';
import { api, server } from '../../test/server';

const webauthn = vi.hoisted(() => ({ startAuthentication: vi.fn(), startRegistration: vi.fn() }));
vi.mock('@simplewebauthn/browser', async (importOriginal) =>
  (await import('../../test/webauthn-mock')).webauthnModule(importOriginal, webauthn),
);

const PAY = operation('pay_invoice');
const DIGEST = PAY.review.digest;
const GRANT = { ...fixture('operation_authorization'), operation_id: PAY.id, node_id: PAY.node_id, review_digest: DIGEST };
const CHALLENGE = nostrChallenge('operation', { operationId: PAY.id, digest: DIGEST });

interface Calls {
  starts: { operationId: string; body: unknown }[];
  finishes: { operationId: string; body: unknown }[];
}

/** The Nostr step-up endpoints of the reviewed operation. */
function nostrAuthorization({
  start = () => HttpResponse.json({ status: 'challenge_required', challenge: CHALLENGE }),
  grant = GRANT,
}: { start?: () => Response | Promise<Response>; grant?: typeof GRANT } = {}): Calls {
  const calls: Calls = { starts: [], finishes: [] };
  server.use(
    http.post(api('/nodes/:nodeId/operations/:operationId/authorize/nostr'), async ({ request, params }) => {
      calls.starts.push({ operationId: String(params.operationId), body: await request.json() });
      return start();
    }),
    http.post(api('/nodes/:nodeId/operations/:operationId/authorize/nostr/finish'), async ({ request, params }) => {
      calls.finishes.push({ operationId: String(params.operationId), body: await request.json() });
      return HttpResponse.json(grant);
    }),
  );
  return calls;
}

const payButton = () => screen.findByRole('button', { name: 'Pay with Nostr' });

beforeEach(() => {
  server.use(
    http.get(api('/session'), () =>
      HttpResponse.json({ ...fixture('session'), auth_method: 'nostr', nostr_pubkey: NOSTR_KEYS[0].pubkey }),
    ),
  );
});

describe('step-up for a Nostr session', () => {
  it('signs the operation-bound template and confirms with the returned grant, never a passkey', async () => {
    const signEvent = installNostrExtension();
    const journal = mockJournal({ created: PAY });
    const calls = nostrAuthorization();
    const view = renderApp(`/nodes/lnd-lab/operations/${PAY.id}`);

    await view.user.dblClick(await payButton());

    await waitFor(() => expect(journal.confirms).toHaveLength(1));
    expect(calls.starts).toEqual([{ operationId: PAY.id, body: { review_digest: DIGEST } }]);
    expect(signEvent).toHaveBeenCalledWith(CHALLENGE.event);
    expect(calls.finishes).toEqual([
      {
        operationId: PAY.id,
        body: { challenge_id: CHALLENGE.challenge_id, review_digest: DIGEST, event: signedEvent(CHALLENGE.event) },
      },
    ]);
    expect(journal.confirms[0].body).toEqual({ review_digest: DIGEST, authorization_id: GRANT.authorization_id });
    expect(journal.authorizes).toEqual([]);
    expect(journal.finishes).toEqual([]);
    expect(webauthn.startAuthentication).not.toHaveBeenCalled();
  });

  it('uses a recent-auth grant without asking the extension', async () => {
    const signEvent = installNostrExtension();
    const journal = mockJournal({ created: PAY });
    nostrAuthorization({ start: () => HttpResponse.json({ status: 'authorized', authorization: GRANT }) });
    const view = renderApp(`/nodes/lnd-lab/operations/${PAY.id}`);

    await view.user.click(await payButton());

    await waitFor(() => expect(journal.confirms).toHaveLength(1));
    expect(signEvent).not.toHaveBeenCalled();
    expect(journal.confirms[0].body).toEqual({ review_digest: DIGEST, authorization_id: GRANT.authorization_id });
  });

  it('refuses a grant for another operation and confirms nothing', async () => {
    installNostrExtension();
    const journal = mockJournal({ created: PAY });
    nostrAuthorization({ grant: { ...GRANT, review_digest: 'f'.repeat(64) } });
    const view = renderApp(`/nodes/lnd-lab/operations/${PAY.id}`);

    await view.user.click(await payButton());

    expect(await screen.findByText('Unexpected response')).toBeInTheDocument();
    expect(journal.confirms).toEqual([]);
  });

  it('says the extension is missing in the error area, with no finish, confirm or retry', async () => {
    const journal = mockJournal({ created: PAY });
    const calls = nostrAuthorization();
    const view = renderApp(`/nodes/lnd-lab/operations/${PAY.id}`);

    await view.user.click(await payButton());

    expect(await screen.findByText('No Nostr extension found.')).toBeInTheDocument();
    expect(calls.starts).toHaveLength(1);
    expect(calls.finishes).toEqual([]);
    expect(journal.confirms).toEqual([]);
    expect(await payButton()).toBeEnabled();
  });

  it('reads a refused signature as nothing sent', async () => {
    installNostrExtension().mockRejectedValue(new Error('User rejected'));
    const journal = mockJournal({ created: PAY });
    const calls = nostrAuthorization();
    const view = renderApp(`/nodes/lnd-lab/operations/${PAY.id}`);

    await view.user.click(await payButton());

    expect(await screen.findByText('Nostr signature canceled. Nothing was sent.')).toBeInTheDocument();
    expect(calls.finishes).toEqual([]);
    expect(journal.confirms).toEqual([]);
  });

  it('abandons the attempt when the review is left while the extension prompt is open', async () => {
    let answer = () => {};
    installNostrExtension().mockImplementation(
      (template: NostrEventTemplate) =>
        new Promise((resolve) => {
          answer = () => resolve(signedEvent(template));
        }),
    );
    const journal = mockJournal({ created: PAY });
    const calls = nostrAuthorization();
    const view = renderApp(`/nodes/lnd-lab/operations/${PAY.id}`);
    await view.user.click(await payButton());
    await waitFor(() => expect(window.nostr?.signEvent).toHaveBeenCalledTimes(1));

    await view.router.navigate({ to: '/nodes/$nodeId/payments', params: { nodeId: 'lnd-lab' } });
    answer();
    await delay(50);

    expect(calls.finishes).toEqual([]);
    expect(journal.confirms).toEqual([]);
  });

  it('keeps the low-risk confirm free of any step-up', async () => {
    const signEvent = installNostrExtension();
    const invoice = operation('create_invoice');
    const journal = mockJournal({ created: invoice });
    const calls = nostrAuthorization();
    const view = renderApp(`/nodes/lnd-lab/operations/${invoice.id}`);

    await view.user.click(await screen.findByRole('button', { name: 'Create invoice' }));

    await waitFor(() => expect(journal.confirms).toHaveLength(1));
    expect(calls.starts).toEqual([]);
    expect(signEvent).not.toHaveBeenCalled();
  });
});
