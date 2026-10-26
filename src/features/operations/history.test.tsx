import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fixture } from '../../test/fixtures';
import { mockJournal, operation } from '../../test/operation-journal';
import { openTechnicalDetails, withinSection } from '../../test/queries';
import { renderApp } from '../../test/render-app';
import { api, server, writableNode } from '../../test/server';

vi.mock('@simplewebauthn/browser', async (importOriginal) =>
  (await import('../../test/webauthn-mock')).webauthnModule(importOriginal, {
    startAuthentication: vi.fn(),
    startRegistration: vi.fn(),
  }),
);

const FORMER_ID = 'retired-lnd';
const FORMER_PUBKEY = '035555555555555555555555555555555555555555555555555555555555555555';

/** A journaled pay operation of a node the server no longer configures. */
function formerOperation(state: Parameters<typeof operation>[1], stage?: string, withResult = false) {
  const op = operation('pay_invoice', state, stage, withResult);
  op.node_id = FORMER_ID;
  op.review.node = { node_id: FORMER_ID, network: 'testnet', identity_pubkey: FORMER_PUBKEY, identity_revision: 'retired-binding-7' };
  return op;
}

let posts: string[] = [];

beforeEach(() => {
  posts = [];
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'POST') posts.push(new URL(request.url).pathname);
  });
  return () => server.events.removeAllListeners();
});

function journalPage(items: ReturnType<typeof operation>[], nodeId: string, network: string) {
  return { ...fixture('operations_page'), node_id: nodeId, network, items, next_cursor: null, truncated: false };
}

describe('history of a node that is no longer configured', () => {
  it('lists and opens its operations although the node lookup is 404', async () => {
    mockJournal({ created: formerOperation('unknown', 'reconciling') });
    server.use(
      http.get(api(`/nodes/${FORMER_ID}/operations`), () =>
        HttpResponse.json(journalPage([formerOperation('unknown', 'reconciling')], FORMER_ID, 'testnet')),
      ),
    );
    const { user } = renderApp(`/nodes/${FORMER_ID}/operations`);

    expect(await screen.findByText('This node is not configured')).toBeInTheDocument();
    await user.click(await screen.findByRole('link', { name: 'Pay invoice' }));

    const review = await withinSection('Reviewed payment');
    expect(review.getByText('From').nextElementSibling).toHaveTextContent(FORMER_ID);
    expect(review.getByText('From').nextElementSibling).toHaveTextContent('Testnet');
    await openTechnicalDetails(user);
    expect(screen.getByText('Node public key').nextElementSibling).toHaveTextContent(FORMER_PUBKEY);
    expect(screen.getAllByText('Outcome unknown').length).toBeGreaterThan(0);
  });

  it('keeps reconciling its unresolved operation through status reads', async () => {
    mockJournal({
      created: formerOperation('unknown', 'reconciling'),
      reads: [formerOperation('unknown', 'reconciling'), formerOperation('succeeded', 'settled', true)],
    });
    renderApp(`/nodes/${FORMER_ID}/operations/${operation('pay_invoice').id}`);

    expect(await screen.findByText('Paid', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(posts).toEqual([]);
  });

  it('never offers confirmation, authorization or a new review for it', async () => {
    mockJournal({ created: formerOperation('awaiting_confirmation') });
    renderApp(`/nodes/${FORMER_ID}/operations/${operation('pay_invoice').id}`);

    expect(await screen.findByText('This node is not configured anymore.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pay with passkey' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Start a new review' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start a new review' })).not.toBeInTheDocument();
    expect(posts).toEqual([]);
  });

  it.each(['', '/payments', '/payments/new', '/onchain/send', '/channels/new'])(
    'shows its workspace page %j as not found',
    async (path) => {
      renderApp(`/nodes/${FORMER_ID}${path}`);
      expect(await screen.findByText('Node not found')).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
      expect(posts).toEqual([]);
    },
  );
});

describe('history of a configured node whose identity changed', () => {
  const NEW_PUBKEY = '036666666666666666666666666666666666666666666666666666666666666666';

  beforeEach(() => {
    server.use(
      http.get(api(`/nodes/${writableNode.id}`), () =>
        HttpResponse.json({ ...writableNode, identity_pubkey: NEW_PUBKEY, identity_revision: 'synthetic-lnd-binding-2' }),
      ),
    );
  });

  it('shows the original reviewed identity and blocks confirming it against the new one', async () => {
    mockJournal({ created: operation('pay_invoice') });
    const { user } = renderApp(`/nodes/${writableNode.id}/operations/${operation('pay_invoice').id}`);

    expect(await screen.findByText('The node identity or network changed after this review.')).toBeInTheDocument();
    await openTechnicalDetails(user);
    expect(screen.getByText('Node public key').nextElementSibling).toHaveTextContent(
      operation('pay_invoice').review.node.identity_pubkey,
    );
    expect(screen.queryByRole('button', { name: 'Pay with passkey' })).not.toBeInTheDocument();
    expect(posts).toEqual([]);
  });

  it('still observes an unresolved operation of the original identity to its outcome', async () => {
    mockJournal({
      created: operation('pay_invoice', 'unknown', 'reconciling'),
      reads: [operation('pay_invoice', 'unknown', 'reconciling'), operation('pay_invoice', 'succeeded', 'settled', true)],
    });
    renderApp(`/nodes/${writableNode.id}/operations/${operation('pay_invoice').id}`);

    expect(await screen.findByText('Paid', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(posts).toEqual([]);
  });
});
