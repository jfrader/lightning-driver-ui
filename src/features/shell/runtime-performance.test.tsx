import { act, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { nodeKeys } from '../../api/node-queries';
import type { Channel, PageMeta, Peer } from '../../api/types';
import { setWideLayout } from '../../test/environment';
import { fixture } from '../../test/fixtures';
import { renderApp } from '../../test/render-app';
import { api, server } from '../../test/server';

const counts = vi.hoisted(() => ({ rows: new Map<string, number>(), shell: 0 }));

vi.mock('../display/Identifier', async (original) => {
  const actual = await original<typeof import('../display/Identifier')>();
  return { ...actual, ShortIdentifier: (props: { value: string }) => {
    counts.rows.set(props.value, (counts.rows.get(props.value) ?? 0) + 1);
    return <actual.ShortIdentifier {...props} />;
  } };
});

vi.mock('./ContentRegion', async (original) => {
  const actual = await original<typeof import('./ContentRegion')>();
  return { ...actual, ContentRegion: (props: Parameters<typeof actual.ContentRegion>[0]) => {
    counts.shell++;
    return <actual.ContentRegion {...props} />;
  } };
});

async function tick(milliseconds = 30_000) {
  await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); });
}

describe('runtime performance', () => {
  it('keeps money controls subscribed to live read-only and capability changes', async () => {
    const node = fixture('node_lnd');
    const view = renderApp('/nodes/lnd-lab/channels?send=1');
    const pay = await screen.findByRole('menuitem', { name: 'Pay invoice' });
    expect(pay).toBeEnabled();
    act(() => { view.queryClient.setQueryData(nodeKeys.summary(node.id), { ...node, read_only: true }); });
    await waitFor(() => expect(pay).toBeDisabled());
    expect(pay).toHaveAccessibleDescription('This node is read-only.');
    act(() => { view.queryClient.setQueryData(nodeKeys.summary(node.id), {
      ...node, capabilities: { ...node.capabilities, pay_invoice: { enabled: false, reason: 'permission_denied' } },
    }); });
    await waitFor(() => expect(pay).toHaveAccessibleDescription('The node credentials do not allow this action.'));
    act(() => { view.queryClient.setQueryData(nodeKeys.summary(node.id), node); });
    await waitFor(() => expect(pay).toBeEnabled());
  });

  it('stops chooser-owned requests during 90 seconds closed and refreshes on every open', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    let requests = 0;
    server.use(http.get(api('/nodes'), () => {
      requests++;
      return HttpResponse.json(fixture('nodes_page'));
    }));
    const view = renderApp('/nodes/lnd-lab/channels');
    const chooser = await screen.findByRole('combobox', { name: 'Node' });
    expect(requests).toBe(0);
    await view.user.click(chooser);
    await waitFor(() => expect(requests).toBe(1));
    await waitFor(() => expect(view.queryClient.isFetching({ queryKey: ['fleet'] })).toBe(0));
    await view.user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    const start = requests;
    for (let i = 0; i < 3; i++) {
      await tick();
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    console.info('closed chooser requests / 90s:', requests - start);
    expect(requests - start).toBe(0);
    await view.user.click(chooser);
    await waitFor(() => expect(requests).toBe(start + 1));
    await waitFor(() => expect(view.queryClient.isFetching({ queryKey: ['fleet'] })).toBe(0));
    await view.user.keyboard('{Escape}');
    await view.user.click(chooser);
    await waitFor(() => expect(requests).toBe(start + 2));
    await waitFor(() => expect(view.queryClient.isFetching({ queryKey: ['fleet'] })).toBe(0));
    await tick(30_100);
    await waitFor(() => expect(requests).toBe(start + 3));
  });

  it('leaves the fleet page polling while its chooser is closed', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const intervals = vi.spyOn(globalThis, 'setInterval');
    let requests = 0;
    server.use(http.get(api('/nodes'), () => {
      requests++;
      return HttpResponse.json(fixture('nodes_page'));
    }));
    const view = renderApp('/fleet');
    await screen.findByRole('combobox', { name: 'Node' });
    await waitFor(() => expect(requests).toBeGreaterThan(0));
    await screen.findByRole('link', { name: fixture('nodes_page').items[0].label });
    await waitFor(() => expect(view.queryClient.isFetching({ queryKey: ['fleet'] })).toBe(0));
    await waitFor(() => expect(intervals.mock.calls.some(([, delay]) => delay === 30_000)).toBe(true));
    const start = requests;
    await tick(30_100);
    await waitFor(() => expect(requests).toBe(start + 1));
  });

  it.each([
    ['channels', true], ['channels', false], ['peers', true], ['peers', false],
  ] as const)('does not render unchanged %s rows or shell on an observation poll (wide %s)', async (resource, wide) => {
    counts.rows.clear();
    setWideLayout(wide);
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const node = fixture('node_lnd');
    let observations = 0;
    let observedAt = '';
    server.use(http.get(api('/nodes/lnd-lab'), () => {
      observations++;
      observedAt = new Date().toISOString();
      return HttpResponse.json({ ...node, status: { ...node.status, observed_at: observedAt } });
    }));
    const ids = Array.from({ length: 100 }, (_, index) => `02${index.toString(16).padStart(64, '0')}`);
    const channels = fixture('channels_page');
    const peers = fixture('peers_page');
    server.use(http.get(api(`/nodes/lnd-lab/${resource}`), () => HttpResponse.json(resource === 'channels'
      ? { ...channels, items: ids.map((id, index) => ({ ...channels.items[0], id: `channel-${index}`, peer_pubkey: id })) }
      : { ...peers, items: ids.map((id) => ({ ...peers.items[0], pubkey: id })) })));
    const view = renderApp(`/nodes/lnd-lab/${resource}`);
    await waitFor(() => expect(ids.every((id) => counts.rows.has(id))).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 100));
    counts.rows.clear();
    counts.shell = 0;
    const start = observations;
    await tick(30_100);
    await waitFor(() => expect(observations).toBeGreaterThan(start));
    await waitFor(() => expect(view.queryClient.getQueryData(nodeKeys.summary(node.id))).toMatchObject({ status: { observed_at: observedAt } }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    console.info(resource, 'row renders:', ids.map((id) => counts.rows.get(id) ?? 0), 'shell:', counts.shell);
    expect(ids.map((id) => counts.rows.get(id) ?? 0)).toEqual(ids.map(() => 0));
    expect(counts.shell).toBe(0);
    if (resource === 'channels') {
      view.queryClient.setQueriesData<PageMeta & { items: Channel[] }>({ queryKey: nodeKeys.detail(node.id, resource) }, (page) => page && ({
        ...page, items: page.items.map((item) => ({ ...item, capacity_sat: '123456' })),
      }));
    } else {
      view.queryClient.setQueriesData<PageMeta & { items: Peer[] }>({ queryKey: nodeKeys.detail(node.id, resource) }, (page) => page && ({
        ...page, items: page.items.map((item) => ({ ...item, address: 'changed.example:9735' })),
      }));
    }
    await waitFor(() => expect(ids.every((id) => (counts.rows.get(id) ?? 0) > 0)).toBe(true));
  });
});
