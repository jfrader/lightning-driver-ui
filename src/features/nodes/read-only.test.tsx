import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderApp } from '../../test/render-app';
import { api, readOnlyNode, server, writableNode } from '../../test/server';
import { fixture } from '../../test/fixtures';


const RO = readOnlyNode.id;
const MUTATION_ENTRIES = [
  'Receive',
  'Pay invoice',
  'New address',
  'Send on-chain',
  'Send',
  'Open channel',
  'Open channel…',
  'Connect peer',
  'Create invoice',
  'Disconnect',
  'Disconnect peer…',
  'Close',
  'Close channel…',
  'Disconnect peer',
  'Close channel',
];

let operationPosts = 0;

beforeEach(() => {
  operationPosts = 0;
  server.use(
    http.post(api('/nodes/:nodeId/operations'), () => {
      operationPosts += 1;
      return HttpResponse.json({}, { status: 500 });
    }),
  );
});

async function expectDisabledEntries(names: string[], user: ReturnType<typeof renderApp>['user']) {
  for (const name of names) {
    const controls = await screen.findAllByRole('button', { name });
    for (const control of controls) {
      expect(control).toBeDisabled();
      expect(control).toHaveAccessibleDescription('This node is read-only.');
      const reason = document.getElementById(control.getAttribute('aria-describedby')!);
      expect(reason).toBeVisible();
      await user.click(control);
    }
  }
  for (const name of MUTATION_ENTRIES) {
    expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    for (const control of screen.queryAllByRole('button', { name })) {
      expect(control).toBeDisabled();
    }
  }
  expect(operationPosts).toBe(0);
}

describe('read-only node', () => {
  it('shows disabled mutation entries with announced reasons on the overview without posting operations', async () => {
    const { user } = renderApp(`/nodes/${RO}`);
    expect(await screen.findByRole('heading', { name: readOnlyNode.label })).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Node status' })).getByText('Read-only')).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Balances' })).toBeInTheDocument();
    await expectDisabledEntries(['Pay invoice', 'Create invoice', 'New address', 'Send on-chain', 'Open channel'], user);
  });

  it.each([
    ['invoices', ['Create invoice']],
    ['payments', ['Pay invoice']],
    ['peers', ['Connect peer']],
    ['channels', ['Open channel']],
    ['onchain', ['New address', 'Send on-chain']],
  ])('shows disabled mutation entries with announced reasons on the %s list without posting operations', async (section, entries) => {
    const { user } = renderApp(`/nodes/${RO}/${section}`);
    expect(await screen.findByRole('heading', { level: 2 })).toBeInTheDocument();
    await screen.findAllByText(/Observed|No /);
    await expectDisabledEntries(entries, user);
  });

  it('keeps connected-peer actions disabled with announced reasons without posting operations', async () => {
    const peer = fixture('peers_page').items.find((item) => item.connected)!;
    const { user } = renderApp(`/nodes/${RO}/peers?selected=${peer.pubkey}`);
    await expectDisabledEntries(['Connect peer', 'Open channel', 'Disconnect peer'], user);
  });

  it('keeps channel-close disabled with an announced reason without posting operations', async () => {
    const channel = fixture('channels_page').items[0];
    const { user } = renderApp(`/nodes/${RO}/channels?selected=${channel.id}`);
    await expectDisabledEntries(['Open channel', 'Close channel'], user);
  });

  it('labels a read-only node read-only even when its capabilities are enabled', async () => {
    server.use(http.get(api('/nodes'), () => HttpResponse.json({
      ...fixture('nodes_page'), items: [{ ...writableNode, read_only: true }], next_cursor: null, truncated: false,
    })));
    renderApp('/fleet');
    expect((await screen.findAllByText('Read-only')).length).toBeGreaterThan(0);
    expect(screen.queryByText('All actions')).not.toBeInTheDocument();
  });

  it.each([
    'invoices/new',
    'payments/new',
    'peers/new',
    'channels/new',
    'channels/some-channel/close',
    'onchain/receive',
    'onchain/send',
  ])('rejects the %s deep link without rendering a form', async (path) => {
    renderApp(`/nodes/${RO}/${path}`);
    expect((await screen.findAllByText('This node is read-only.')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create|Review|Connect|Decode/ })).not.toBeInTheDocument();
    expect(operationPosts).toBe(0);
  });
});
