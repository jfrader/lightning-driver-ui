import { screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderApp } from '../../test/render-app';
import { api, readOnlyNode, server } from '../../test/server';

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

function expectNoMutationEntries() {
  for (const name of MUTATION_ENTRIES) {
    expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
  }
}

describe('read-only node', () => {
  it('shows the read-only state and no mutation entry points on the overview', async () => {
    renderApp(`/nodes/${RO}`);
    expect(await screen.findByRole('heading', { name: readOnlyNode.label })).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Node status' })).getByText('Read-only')).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Balances' })).toBeInTheDocument();
    expectNoMutationEntries();
  });

  it.each(['invoices', 'payments', 'peers', 'channels', 'onchain'])('hides mutation entries on the %s list', async (section) => {
    renderApp(`/nodes/${RO}/${section}`);
    expect(await screen.findByRole('heading', { level: 2 })).toBeInTheDocument();
    await screen.findAllByText(/Observed|No /);
    expectNoMutationEntries();
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
    expect(await screen.findByText('This node is read-only.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create|Review|Connect|Decode/ })).not.toBeInTheDocument();
    expect(operationPosts).toBe(0);
  });
});
