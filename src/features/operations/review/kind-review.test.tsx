import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { setWideLayout } from '../../../test/environment';
import { fixture } from '../../../test/fixtures';
import { mockJournal, operation } from '../../../test/operation-journal';
import { openTechnicalDetails } from '../../../test/queries';
import { renderApp } from '../../../test/render-app';
import { api, server } from '../../../test/server';
import { assertion } from '../../../test/webauthn-mock';

const webauthn = vi.hoisted(() => ({ startAuthentication: vi.fn(), startRegistration: vi.fn() }));
vi.mock('@simplewebauthn/browser', async (importOriginal) =>
  (await import('../../../test/webauthn-mock')).webauthnModule(importOriginal, webauthn),
);

type Kind = Parameters<typeof operation>[0];

const PEER = fixture('peers_page').items[0].pubkey;

/** Review title, confirm label, confirm mode and what the consent must show, per kind. */
const KINDS: {
  kind: Exclude<Kind, 'pay_invoice'>;
  title: string;
  confirm: string;
  sensitive: boolean;
  shows: (string | RegExp)[];
  hides?: string[];
}[] = [
  {
    kind: 'create_invoice',
    title: 'Review invoice',
    confirm: 'Create invoice',
    sensitive: false,
    shows: ['2,500 sat', 'Expires after', /1 hour/],
    hides: ['Total', 'Estimated fee'],
  },
  {
    kind: 'send_onchain',
    title: 'Review send',
    confirm: 'Send with passkey',
    sensitive: true,
    shows: ['10,000 sat', 'Requested; the final fee can differ', '2 sat/vB', '200 sat', 'SYNTHETIC_REGTEST_ADDRESS_NOT_SENDABLE'],
    hides: ['Total'],
  },
  {
    kind: 'open_channel',
    title: 'Review channel open',
    confirm: 'Open channel with passkey',
    sensitive: true,
    shows: ['1,000,000 sat', 'Channel capacity from this node', 'Requested; the final fee can differ', 'Private', PEER],
    hides: ['Total'],
  },
  {
    kind: 'close_channel',
    title: 'Review channel close',
    confirm: 'Close channel with passkey',
    sensitive: true,
    shows: ['channel-synthetic-1', 'Negotiated with the peer', 'Cooperative close only. The peer must be online.', PEER],
    hides: ['Total'],
  },
  {
    kind: 'connect_peer',
    title: 'Review connection',
    confirm: 'Connect',
    sensitive: false,
    shows: [PEER, 'peer.example.invalid:9735'],
  },
  {
    kind: 'disconnect_peer',
    title: 'Review disconnect',
    confirm: 'Disconnect',
    sensitive: false,
    shows: [PEER, 'Channels with this peer are inactive while it is disconnected.'],
  },
  {
    kind: 'new_address',
    title: 'Review new address',
    confirm: 'New address',
    sensitive: false,
    shows: ['Native SegWit (P2WPKH)'],
  },
];

const pathOf = (kind: Kind) => `/nodes/lnd-lab/operations/${operation(kind).id}`;

/** Identifiers (long, without spaces) render in groups, so they are matched through their title. */
function expectShown(text: string | RegExp) {
  if (typeof text === 'string' && text.length > 24 && !/\s/.test(text)) {
    expect(screen.getAllByTitle(text).length).toBeGreaterThan(0);
    return;
  }
  expect(screen.getAllByText(text).length).toBeGreaterThan(0);
}

describe.each(KINDS)('$kind review', ({ kind, title, confirm, sensitive, shows, hides = [] }) => {
  it('shows what is being approved from the server review, with the bound node', async () => {
    mockJournal({ created: operation(kind) });
    renderApp(pathOf(kind));

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText('Not sent')).toBeInTheDocument();
    for (const text of shows) expectShown(text);
    for (const text of hides) expect(screen.queryByText(text)).not.toBeInTheDocument();
    expect(screen.getByText('From').nextElementSibling).toHaveTextContent('LND labRegtestlnd-lab');
  });

  it(`confirms with one explicit ${sensitive ? 'passkey step-up' : 'low-risk confirm'}, never autofocused`, async () => {
    webauthn.startAuthentication.mockResolvedValue(assertion);
    const calls = mockJournal({ created: operation(kind) });
    const { user } = renderApp(pathOf(kind));
    const button = await screen.findByRole('button', { name: confirm });
    expect(button).not.toHaveFocus();

    await user.keyboard('{Enter}');
    expect(calls.confirms).toEqual([]);
    await user.dblClick(button);

    await waitFor(() => expect(calls.confirms).toHaveLength(1));
    expect(calls.authorizes).toHaveLength(sensitive ? 1 : 0);
    expect(calls.confirms[0]?.body).toEqual({
      review_digest: operation(kind).review.digest,
      authorization_id: sensitive ? fixture('operation_authorization').authorization_id : null,
    });
  });

  it('blocks confirmation with the reason when the node no longer allows the action', async () => {
    const calls = mockJournal({ created: operation(kind) });
    server.use(
      http.get(api('/nodes/lnd-lab'), () => {
        const node = fixture('node_lnd');
        return HttpResponse.json({ ...node, capabilities: { ...node.capabilities, [kind]: { enabled: false, reason: 'syncing' } } });
      }),
    );
    renderApp(pathOf(kind));

    expect(await screen.findByText('The node is syncing.')).toBeInTheDocument();
    expect(screen.getByText('Nothing was sent.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: confirm })).not.toBeInTheDocument();
    expect(calls.authorizes).toEqual([]);
  });
});

describe('review details and destructive tone', () => {
  it('keeps technical identifiers collapsed and complete', async () => {
    mockJournal({ created: operation('send_onchain') });
    const { user } = renderApp(pathOf('send_onchain'));
    await screen.findByRole('heading', { name: 'Review send' });
    expect(screen.queryByText('Review digest')).not.toBeVisible();

    await openTechnicalDetails(user);
    expect(screen.getByText('Review digest').nextElementSibling).toHaveTextContent(operation('send_onchain').review.digest);
    expect(screen.queryByText('Invoice expires')).not.toBeInTheDocument();
  });

  it('offers a discard back to the form beside the primary action on desktop', async () => {
    setWideLayout(true);
    mockJournal({ created: operation('open_channel') });
    renderApp(pathOf('open_channel'));
    expect(await screen.findByRole('link', { name: 'Discard review' })).toHaveAttribute(
      'href',
      `/nodes/lnd-lab/channels/new?peer=${PEER}`,
    );
  });

  it('blocks an expired review of any kind', async () => {
    vi.setSystemTime(new Date('2026-10-21T12:06:00Z'));
    mockJournal({ created: operation('connect_peer') });
    renderApp(pathOf('connect_peer'));
    expect(await screen.findByText('This review expired.')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start a new review' })).toHaveAttribute('href', '/nodes/lnd-lab/peers/new');
  });
});
