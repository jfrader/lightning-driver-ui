import type { Query, QueryClient } from '@tanstack/react-query';
import type { Operation, OperationState } from '../../api/types';
import { invalidateAffectedReads } from './affected-reads';

const TERMINAL: ReadonlySet<OperationState> = new Set(['succeeded', 'failed', 'expired']);

export function observeOperationTransitions(queryClient: QueryClient): () => void {
  const previous = new WeakMap<Query, Operation>();
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return;
    const { query } = event;
    const [scope, nodeId, resource, operationId] = query.queryKey;
    if (scope !== 'node' || resource !== 'operation' || typeof nodeId !== 'string' || typeof operationId !== 'string') return;
    const current = queryClient.getQueryData<Operation>(query.queryKey);
    if (!current || current.node_id !== nodeId || current.id !== operationId) return;
    const before = previous.get(query);
    previous.set(query, current);
    if (!before || TERMINAL.has(before.state)) return;
    if (before.state !== current.state || before.stage !== current.stage || before.error?.outcome !== current.error?.outcome) {
      void invalidateAffectedReads(queryClient, current);
    }
  });
}
