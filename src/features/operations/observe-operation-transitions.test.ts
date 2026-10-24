import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { nodeKeys } from '../../api/node-queries';
import { Operation as validateOperation } from '../../api/generated/validators';
import type { Operation } from '../../api/types';
import { fixture } from '../../test/fixtures';
import { observeOperationTransitions } from './observe-operation-transitions';

function pending(nodeId = 'lnd-lab'): Operation {
  const operation = { ...fixture('operation_review'), node_id: nodeId, state: 'pending', stage: 'submitted' };
  if (!validateOperation(operation)) throw new Error('Invalid operation fixture');
  return operation;
}

function watchRead(client: QueryClient, queryKey: readonly unknown[]) {
  const read = vi.fn(async () => 'fresh');
  const observer = new QueryObserver(client, { queryKey, queryFn: read, staleTime: Infinity, initialData: 'cached' });
  const unsubscribe = observer.subscribe(() => undefined);
  return { read, unsubscribe };
}

describe('operation transitions', () => {
  it('deduplicates read invalidation for a batch of changed list operations', async () => {
    const client = new QueryClient();
    const stop = observeOperationTransitions(client);
    const first = pending();
    const second = { ...first, id: '00000000-0000-4000-8000-000000000802' };
    const summary = watchRead(client, nodeKeys.summary(first.node_id));
    const payments = watchRead(client, nodeKeys.detail(first.node_id, 'payments'));
    const key = nodeKeys.list(first.node_id, 'operations', { state: 'nonterminal' });
    client.setQueryData(key, { items: [first, second] });
    client.setQueryData(key, { items: [] });
    await vi.waitFor(() => expect(summary.read).toHaveBeenCalledTimes(1));
    expect(payments.read).toHaveBeenCalledTimes(1);
    summary.unsubscribe();
    payments.unsubscribe();
    stop();
    client.clear();
  });

  it.each(['terminal', 'removed', 'new'] as const)('refreshes affected reads when a list observes an operation %s', async (change) => {
    const client = new QueryClient();
    const stop = observeOperationTransitions(client);
    const op = pending();
    const summary = watchRead(client, nodeKeys.summary(op.node_id));
    const payments = watchRead(client, nodeKeys.detail(op.node_id, 'payments'));
    const key = nodeKeys.list(op.node_id, 'operations', { state: 'nonterminal', limit: '100' });
    client.setQueryData(key, { items: change === 'new' ? [] : [op] });
    const items = change === 'removed' ? [] : [{ ...op, state: change === 'terminal' ? 'succeeded' : op.state }];
    client.setQueryData(key, { items });
    await vi.waitFor(() => expect(summary.read).toHaveBeenCalledTimes(1));
    expect(payments.read).toHaveBeenCalledTimes(1);
    client.setQueryData(key, { items });
    expect(summary.read).toHaveBeenCalledTimes(1);
    summary.unsubscribe();
    payments.unsubscribe();
    stop();
    client.clear();
  });

  it('refreshes affected reads exactly once for a nonterminal to terminal transition, regardless of subscribers', async () => {
    const client = new QueryClient();
    const stop = observeOperationTransitions(client);
    const op = pending();
    const reads = ['summary', 'payments', 'balances', 'channels'].map((resource) =>
      watchRead(client, nodeKeys.detail(op.node_id, resource)),
    );
    reads.push(watchRead(client, nodeKeys.list(op.node_id, 'operations', { state: 'nonterminal' })));
    reads.push(watchRead(client, nodeKeys.list(op.node_id, 'operations', { cursor: 'older-page' })));
    reads.push(watchRead(client, ['fleet', { cursor: undefined }]));
    const unrelated = watchRead(client, nodeKeys.detail(op.node_id, 'invoices'));
    const key = nodeKeys.operation(op.node_id, op.id);
    client.setQueryData(key, op);
    const observer = new QueryObserver(client, { queryKey: key, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => undefined);
    const unsubscribeAgain = observer.subscribe(() => undefined);
    client.setQueryData(key, { ...op, state: 'succeeded', stage: 'settled' });
    await vi.waitFor(() => reads.forEach(({ read }) => expect(read).toHaveBeenCalledTimes(1)));
    client.setQueryData(key, { ...op, state: 'succeeded', stage: 'settled', updated_at: '2026-10-21T12:01:00Z' });
    client.setQueryData(key, { ...op, state: 'failed' });
    client.invalidateQueries({ queryKey: nodeKeys.summary(op.node_id), refetchType: 'none' });
    reads.forEach(({ read }) => expect(read).toHaveBeenCalledTimes(1));
    expect(unrelated.read).not.toHaveBeenCalled();
    unsubscribe();
    unsubscribeAgain();
    reads.forEach(({ unsubscribe }) => unsubscribe());
    unrelated.unsubscribe();
    stop();
    client.clear();
  });

  it('refreshes only the operation node and fleet when a nonterminal stage changes', async () => {
    const client = new QueryClient();
    const stop = observeOperationTransitions(client);
    const op = pending('other-node');
    const other = watchRead(client, nodeKeys.summary(op.node_id));
    const current = watchRead(client, nodeKeys.summary('lnd-lab'));
    const fleet = watchRead(client, ['fleet']);
    const key = nodeKeys.operation(op.node_id, op.id);
    client.setQueryData(key, op);
    expect(other.read).not.toHaveBeenCalled();
    client.setQueryData(key, { ...op, stage: 'reconciling' });
    await vi.waitFor(() => expect(other.read).toHaveBeenCalledTimes(1));
    expect(fleet.read).toHaveBeenCalledTimes(1);
    expect(current.read).not.toHaveBeenCalled();
    other.unsubscribe();
    current.unsubscribe();
    fleet.unsubscribe();
    stop();
    client.clear();
  });

  it('ignores terminal to terminal changes when the first read was already terminal', () => {
    const client = new QueryClient();
    const stop = observeOperationTransitions(client);
    const op = pending();
    const summary = watchRead(client, nodeKeys.summary(op.node_id));
    const key = nodeKeys.operation(op.node_id, op.id);
    client.setQueryData(key, { ...op, state: 'succeeded', stage: 'broadcast' });
    client.setQueryData(key, { ...op, state: 'succeeded', stage: 'confirmed' });
    client.setQueryData(key, { ...op, state: 'failed' });
    expect(summary.read).not.toHaveBeenCalled();
    summary.unsubscribe();
    stop();
    client.clear();
  });
});
