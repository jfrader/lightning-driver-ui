import { Profiler } from 'react';
import { act, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { setWideLayout } from '../../test/environment';
import { fixture } from '../../test/fixtures';
import { withinSection } from '../../test/queries';
import { renderApp } from '../../test/render-app';
import { api, server } from '../../test/server';

const commits = vi.hoisted(() => new Map<string, number>());
const comparisons = vi.hoisted(() => vi.fn());
vi.mock('./payment-columns', async (importOriginal) => {
  const original = await importOriginal<typeof import('./payment-columns')>();
  return {
    ...original,
    paymentColumns: (...args: Parameters<typeof original.paymentColumns>) => original.paymentColumns(...args).map((column) => ({
      ...column,
      compare: column.compare && ((a: Parameters<typeof column.cell>[0], b: Parameters<typeof column.cell>[0]) => {
        comparisons();
        return column.compare!(a, b);
      }),
      cell: (payment: Parameters<typeof column.cell>[0]) => (
        <Profiler id={column.id} onRender={(id) => commits.set(id, (commits.get(id) ?? 0) + 1)}>
          {column.cell(payment)}
        </Profiler>
      ),
    })),
  };
});

const PAYMENT = fixture('payments_page').items[0];
const SMALL = {
  ...PAYMENT,
  payment_hash: 'b'.repeat(64),
  amount_msat: '1000',
  fee_msat: null,
  destination: null,
  state: 'unknown' as const,
  created_at: '2026-10-20T09:00:00Z',
};

function page(items: unknown[]) {
  return { ...fixture('payments_page'), items };
}

describe('payments list', () => {
  it.each(['amount', 'fee'] as const)('sorts %s exactly with missing values last in both directions', async (key) => {
    setWideLayout(true);
    const values = [null, '9007199254740993', '0', '9007199254740992', null];
    const items = values.map((value, index) => ({
      ...PAYMENT,
      payment_hash: 'abcde'[index].repeat(64),
      amount_msat: value,
      fee_msat: value,
    }));
    server.use(http.get(api('/nodes/:nodeId/payments'), () => HttpResponse.json(page(items))));
    const { router } = renderApp(`/nodes/lnd-lab/payments?sort=${key}`);
    const table = await screen.findByRole('table');
    const order = () => within(table).getAllByRole('link').map((link) => new URL(link.getAttribute('href') ?? '', 'http://localhost').searchParams.get('selected'));
    const hashes = (indices: number[]) => indices.map((index) => items[index].payment_hash);
    expect(order()).toEqual(hashes([1, 3, 2, 0, 4]));
    await router.navigate({ to: '/nodes/$nodeId/payments', params: { nodeId: 'lnd-lab' }, search: { sort: key, dir: 'asc' } });
    await waitFor(() => expect(order()).toEqual(hashes([2, 3, 1, 0, 4])));
    await router.navigate({ to: '/nodes/$nodeId/payments', params: { nodeId: 'lnd-lab' }, search: { sort: key, dir: 'desc' } });
    await waitFor(() => expect(order()).toEqual(hashes([1, 3, 2, 0, 4])));
  });

  it('ticks populated timestamps without recommitting amount, state or destination cells or re-sorting', async () => {
    setWideLayout(true);
    const items = Array.from({ length: 40 }, (_, index) => ({ ...PAYMENT, payment_hash: index.toString(16).padStart(64, '0') }));
    server.use(http.get(api('/nodes/:nodeId/payments'), () => HttpResponse.json(page(items))));
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-10-21T23:59:59Z'));
    const { queryClient } = renderApp('/nodes/lnd-lab/payments?sort=amount&dir=asc');
    const table = await screen.findByRole('table');
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(41));
    const before = new Map(commits);
    const comparisonsBefore = comparisons.mock.calls.length;
    expect(comparisonsBefore).toBeGreaterThan(0);
    const timeBefore = within(table).getAllByRole('row')[1].textContent;
    await act(() => vi.advanceTimersByTime(15_000));
    expect(within(table).getAllByRole('row')[1].textContent).not.toBe(timeBefore);
    expect(commits.get('time')).toBe((before.get('time') ?? 0) + 40);
    for (const id of ['amount', 'fee', 'ratio', 'state', 'destination']) expect(commits.get(id)).toBe(before.get(id));
    expect(comparisons).toHaveBeenCalledTimes(comparisonsBefore);
    queryClient.clear();
  });

  it('shows the contract columns with exact values and the fee ratio', async () => {
    setWideLayout(true);
    server.use(http.get(api('/nodes/:nodeId/payments'), () => HttpResponse.json(page([PAYMENT, SMALL]))));
    renderApp('/nodes/lnd-lab/payments');

    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Time (UTC)'),
        'State',
        expect.stringContaining('Amount'),
        expect.stringContaining('Fee'),
        'Fee / amount',
        'Destination',
      ]),
    );
    expect(within(table).getByText('0.0049%')).toBeInTheDocument();
    expect(within(table).getByText('Outcome unknown')).toBeInTheDocument();
    expect(within(table).getAllByText('Not reported')).toHaveLength(3);
  });

  it('sorts the loaded snapshot by amount and keeps the order in the URL', async () => {
    setWideLayout(true);
    server.use(http.get(api('/nodes/:nodeId/payments'), () => HttpResponse.json(page([PAYMENT, SMALL]))));
    const { user, router } = renderApp('/nodes/lnd-lab/payments');

    const table = await screen.findByRole('table');
    await user.click(within(table).getByRole('button', { name: /Amount/ }));

    await waitFor(() => expect(router.state.location.search).toMatchObject({ sort: 'amount' }));
    const amounts = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.textContent);
    const order = router.state.location.search.dir === 'asc' ? ['1 sat', '2,500 sat'] : ['2,500 sat', '1 sat'];
    expect(amounts[0]).toContain(order[0]);
    expect(amounts[1]).toContain(order[1]);
  });

  it('opens the selected payment in the inspector with full identifiers', async () => {
    renderApp(`/nodes/lnd-lab/payments?selected=${PAYMENT.payment_hash}`);
    const inspector = await withinSection('Payment');
    expect(inspector.getByText('Payment hash').nextElementSibling).toHaveTextContent(PAYMENT.payment_hash);
    expect(inspector.getByText('Destination').nextElementSibling).toHaveTextContent(PAYMENT.destination ?? '');
    expect(inspector.getByText('Node state').nextElementSibling).toHaveTextContent('SUCCEEDED');
    expect(inspector.getByRole('button', { name: 'Copy payment hash' })).toBeInTheDocument();
    expect(inspector.queryByRole('button', { name: /retry|again/i })).not.toBeInTheDocument();
  });

  it('says when the selected payment is not on the loaded page', async () => {
    renderApp(`/nodes/lnd-lab/payments?selected=${'c'.repeat(64)}`);
    expect(await screen.findByText('This payment is not on the loaded page.')).toBeInTheDocument();
  });

  it('says when a filtered list is empty', async () => {
    server.use(http.get(api('/nodes/:nodeId/payments'), () => HttpResponse.json(page([]))));
    renderApp('/nodes/lnd-lab/payments?status=failed');
    expect(await screen.findByText('No payments in state Failed.')).toBeInTheDocument();
  });

  it('marks a stale list with its age', async () => {
    server.use(
      http.get(api('/nodes/:nodeId/payments'), () =>
        HttpResponse.json({ ...page([PAYMENT]), stale: true, observed_at: '2026-10-21T11:55:00Z' }),
      ),
    );
    renderApp('/nodes/lnd-lab/payments');
    expect(await screen.findByText('Observed 6 minutes ago')).toBeInTheDocument();
    expect(screen.getAllByText('Stale').length).toBeGreaterThan(0);
  });
});
