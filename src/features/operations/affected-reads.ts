import type { QueryClient } from '@tanstack/react-query';
import { nodeKeys } from '../../api/node-queries';
import type { Operation, OperationKind } from '../../api/types';

/** Node reads whose content an operation of each kind can change once the node accepts it. */
const AFFECTED_READS: Record<OperationKind, readonly string[]> = {
  create_invoice: ['invoices'],
  pay_invoice: ['payments', 'balances', 'channels'],
  connect_peer: ['peers'],
  disconnect_peer: ['peers', 'channels'],
  open_channel: ['channels', 'peers', 'balances', 'transactions'],
  close_channel: ['channels', 'balances', 'transactions'],
  new_address: [],
  send_onchain: ['transactions', 'balances'],
};

/** Every kind also changes the operations list and the node's unresolved count. */
const ALWAYS = ['operations', 'summary'] as const;

/**
 * Marks the reads a confirmed operation affects as stale: shown ones refetch now, the rest on their
 * next visit. Invalidation never writes data, so it cannot bring back a cache cleared by sign-out.
 */
export function invalidateAffectedReads(queryClient: QueryClient, operation: Operation): Promise<void[]> {
  const resources = [...AFFECTED_READS[operation.request.kind], ...ALWAYS];
  return Promise.all(
    resources.map((resource) => queryClient.invalidateQueries({ queryKey: nodeKeys.detail(operation.node_id, resource) })),
  );
}
