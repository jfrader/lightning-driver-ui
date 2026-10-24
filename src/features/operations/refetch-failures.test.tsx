import { act, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { nodeKeys } from '../../api/node-queries';
import { fixture } from '../../test/fixtures';
import { mockJournal, operation } from '../../test/operation-journal';
import { renderApp } from '../../test/render-app';
import { api, safeError, server } from '../../test/server';

const failure = () => HttpResponse.json(safeError('backend_unavailable', 'Read unavailable.'), { status: 503 });
const paymentLink = () => screen.queryByRole('link', { name: /Open payment/ });

describe('failed background reads', () => {
  it('keeps cached payment rows with a stale notice and a working retry', async () => {
    const view = renderApp('/nodes/lnd-lab/payments');
    await waitFor(() => expect(paymentLink()).toBeInTheDocument());
    server.use(http.get(api('/nodes/:nodeId/payments'), failure));
    await act(() => view.queryClient.refetchQueries({ queryKey: nodeKeys.detail('lnd-lab', 'payments') }));
    expect(await screen.findByText('Showing last successful read.')).toBeInTheDocument();
    expect(paymentLink()).toBeInTheDocument();
    server.resetHandlers();
    await view.user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByText('Showing last successful read.')).not.toBeInTheDocument());
    expect(paymentLink()).toBeInTheDocument();
  });

  it('shows no payment rows or empty success on an initial failure', async () => {
    server.use(http.get(api('/nodes/:nodeId/payments'), failure));
    renderApp('/nodes/lnd-lab/payments');
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(paymentLink()).not.toBeInTheDocument();
    expect(screen.queryByText('Showing last successful read.')).not.toBeInTheDocument();
    expect(screen.queryByText('No payments on this node.')).not.toBeInTheDocument();
  });

  it('retains expired-cursor recovery even with a cached page', async () => {
    const view = renderApp('/nodes/lnd-lab/payments?cursor=older');
    await waitFor(() => expect(paymentLink()).toBeInTheDocument());
    server.use(http.get(api('/nodes/:nodeId/payments'), () =>
      HttpResponse.json(safeError('cursor_expired', 'Expired.'), { status: 410 }),
    ));
    await act(() => view.queryClient.refetchQueries({ queryKey: nodeKeys.detail('lnd-lab', 'payments') }));
    expect(await screen.findByRole('button', { name: 'Load first page' })).toBeInTheDocument();
    expect(paymentLink()).not.toBeInTheDocument();
  });

  it('keeps cached operation facts but removes confirmation until a successful retry', async () => {
    const op = operation('pay_invoice');
    mockJournal({ created: op });
    const view = renderApp(`/nodes/lnd-lab/operations/${op.id}`);
    expect(await screen.findByRole('button', { name: 'Pay with passkey' })).toBeInTheDocument();
    server.use(http.get(api('/nodes/:nodeId/operations/:operationId'), failure));
    await act(() => view.queryClient.refetchQueries({ queryKey: nodeKeys.operation('lnd-lab', op.id) }));
    expect(await screen.findByText('Showing last successful read.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reviewed payment' })).toBeInTheDocument();
    expect(screen.getAllByText('Awaiting confirmation').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Pay with passkey' })).not.toBeInTheDocument();
    mockJournal({ created: op });
    await view.user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Pay with passkey' })).toBeInTheDocument();
  });

  it('shows no operation facts on an initial failure', async () => {
    server.use(http.get(api('/nodes/:nodeId/operations/:operationId'), failure));
    renderApp(`/nodes/lnd-lab/operations/${fixture('operation_review').id}`);
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reviewed payment' })).not.toBeInTheDocument();
    expect(screen.queryByText('Showing last successful read.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pay with passkey' })).not.toBeInTheDocument();
  });
});
