import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fixture } from '../../test/fixtures';
import { mockJournal, operation } from '../../test/operation-journal';
import { withinSection } from '../../test/queries';
import { renderApp } from '../../test/render-app';
import { api, readOnlyNode, server } from '../../test/server';

vi.mock('@simplewebauthn/browser', async (importOriginal) =>
  (await import('../../test/webauthn-mock')).webauthnModule(importOriginal, {
    startAuthentication: vi.fn(),
    startRegistration: vi.fn(),
  }),
);

const PEER = fixture('peers_page').items[0]?.pubkey ?? '';
/** Disconnect lives in the peer's inspector; this opens it. */
const PEER_PATH = (nodeId: string) => `/nodes/${nodeId}/peers?selected=${PEER}`;

let posts: string[] = [];

beforeEach(() => {
  posts = [];
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'POST') posts.push(new URL(request.url).pathname);
  });
  return () => server.events.removeAllListeners();
});

async function openDisconnectDialog(view: ReturnType<typeof renderApp>) {
  await view.user.click(await screen.findByRole('button', { name: 'Disconnect peer…' }));
  return within(await screen.findByRole('dialog'));
}

describe('disconnect peer', () => {
  it('disconnects after the short confirmation through one create and one low-risk confirm', async () => {
    const calls = mockJournal({
      created: operation('disconnect_peer'),
      confirm: () => HttpResponse.json(operation('disconnect_peer', 'succeeded', 'completed', true)),
    });
    const view = renderApp(PEER_PATH('lnd-lab'));
    const dialog = await openDisconnectDialog(view);

    expect(dialog.getByText(PEER)).toBeInTheDocument();
    await view.user.dblClick(dialog.getByRole('button', { name: 'Disconnect' }));

    expect(await screen.findByText('Peer disconnected')).toBeInTheDocument();
    expect(view.router.state.location.pathname).toBe(`/nodes/lnd-lab/operations/${operation('disconnect_peer').id}`);
    expect(calls.creates.map((call) => call.body)).toEqual([{ kind: 'disconnect_peer', params: { pubkey: PEER } }]);
    expect(calls.confirms.map((call) => call.body)).toEqual([
      { review_digest: operation('disconnect_peer').review.digest, authorization_id: null },
    ]);
  });

  it('sends nothing when the confirmation is canceled', async () => {
    mockJournal({ created: operation('disconnect_peer') });
    const view = renderApp(PEER_PATH('lnd-lab'));
    const dialog = await openDisconnectDialog(view);

    await view.user.click(dialog.getByRole('button', { name: 'Cancel' }));

    expect(posts).toEqual([]);
    expect(view.router.state.location.pathname).toBe('/nodes/lnd-lab/peers');
  });

  it('offers no disconnect for a connected peer of a read-only node', async () => {
    renderApp(PEER_PATH(readOnlyNode.id));

    expect((await withinSection('Peer')).getByTitle(PEER)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Disconnect/ })).not.toBeInTheDocument();
    expect(posts).toEqual([]);
  });

  it('offers no disconnect when the node does not allow it, and says why', async () => {
    server.use(
      http.get(api('/nodes/lnd-lab'), () => {
        const node = fixture('node_lnd');
        const disconnect_peer = { enabled: false, reason: 'permission_denied' };
        return HttpResponse.json({ ...node, capabilities: { ...node.capabilities, disconnect_peer } });
      }),
    );
    renderApp(PEER_PATH('lnd-lab'));

    expect(await screen.findByText('The node credentials do not allow this action.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disconnect peer' })).toBeDisabled();
    expect(posts).toEqual([]);
  });
});
