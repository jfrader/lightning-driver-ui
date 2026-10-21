import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import type { NodeSummary } from '../../api/types';
import { setWideLayout } from '../../test/environment';
import { fixture } from '../../test/fixtures';
import { renderApp } from '../../test/render-app';
import { api, clnNode, readOnlyNode, server, writableNode } from '../../test/server';
import { capabilitySummary } from './labels';

const nodesPage = (items: unknown[]) => ({ ...fixture('nodes_page'), items, next_cursor: null, truncated: false });

describe('fleet', () => {
  it('lists every configured node with its own network, status, access and unresolved count, and no money', async () => {
    setWideLayout(true);
    renderApp('/fleet');

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    const observer = within(rows.find((row) => row.textContent?.includes(readOnlyNode.label)) as HTMLElement);
    expect(observer.getByText('Testnet')).toBeInTheDocument();
    expect(observer.getByText('Offline')).toBeInTheDocument();
    expect(observer.getByText('Stale')).toBeInTheDocument();
    expect(observer.getAllByText('Read-only')).toHaveLength(2);
    expect(observer.getByRole('link', { name: /1 unresolved/ })).toHaveAttribute(
      'href',
      `/nodes/${readOnlyNode.id}/operations?state=nonterminal`,
    );
    const lab = within(rows.find((row) => row.textContent?.includes(writableNode.label)) as HTMLElement);
    expect(lab.getByText('All actions')).toBeInTheDocument();
    expect(lab.getByText('0')).toBeInTheDocument();
    expect(table).not.toHaveTextContent(/ (sat|BTC)/);
  });

  it('opens a node from its row', async () => {
    const { user, router } = renderApp('/fleet');
    await user.click(await screen.findByRole('link', { name: clnNode.label }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/nodes/${clnNode.id}`));
  });

  it('says when no node is configured', async () => {
    server.use(http.get(api('/nodes'), () => HttpResponse.json(nodesPage([]))));
    renderApp('/fleet');
    expect(await screen.findByText('No nodes are configured on this server.')).toBeInTheDocument();
  });
});

describe('capability summary', () => {
  const withCapabilities = (overrides: Partial<NodeSummary['capabilities']>): NodeSummary => ({
    ...(writableNode as NodeSummary),
    capabilities: { ...(writableNode as NodeSummary).capabilities, ...overrides },
  });

  it('reads all actions, one shared reason, or a mixed state', () => {
    expect(capabilitySummary(writableNode as NodeSummary)).toBe('All actions');
    expect(capabilitySummary(readOnlyNode as NodeSummary)).toBe('Read-only');
    expect(capabilitySummary(withCapabilities({ pay_invoice: { enabled: false, reason: 'syncing' } }))).toBe(
      'Some actions unavailable',
    );
  });
});
