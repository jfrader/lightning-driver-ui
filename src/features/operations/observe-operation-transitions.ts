import type { Query, QueryClient } from '@tanstack/react-query';
import type { Operation, OperationState } from '../../api/types';
import { invalidateAffectedReads } from './affected-reads';

const TERMINAL: ReadonlySet<OperationState> = new Set(['succeeded', 'failed', 'expired']);

export function observeOperationTransitions(queryClient: QueryClient): () => void {
  const previous = new WeakMap<Query, Operation>();
  const previousLists = new WeakMap<Query, Operation[]>();
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return;
    const { query } = event;
    const [scope, nodeId, resource, operationId] = query.queryKey;
    if (scope === 'node' && resource === 'operations' && typeof nodeId === 'string') {
      const current = queryClient.getQueryData<{ items: Operation[] }>(query.queryKey)?.items;
      if (!current || !current.every((operation) => operation.node_id === nodeId)) return;
      const before = previousLists.get(query);
      previousLists.set(query, current);
      if (!before) return;
      const byId = new Map(current.map((operation) => [operation.id, operation]));
      const affected: Operation[] = [];
      for (const operation of before) {
        const after = byId.get(operation.id);
        if (!TERMINAL.has(operation.state) && (!after || changed(operation, after))) {
          affected.push(after ?? operation);
        }
      }
      const known = new Set(before.map((operation) => operation.id));
      for (const operation of current) {
        if (!known.has(operation.id)) affected.push(operation);
      }
      if (affected.length) void invalidateAffectedReads(queryClient, ...affected);
      return;
    }
    if (scope !== 'node' || resource !== 'operation' || typeof nodeId !== 'string' || typeof operationId !== 'string') return;
    const current = queryClient.getQueryData<Operation>(query.queryKey);
    if (!current || current.node_id !== nodeId || current.id !== operationId) return;
    const before = previous.get(query);
    previous.set(query, current);
    if (!before || TERMINAL.has(before.state)) return;
    if (changed(before, current)) {
      void invalidateAffectedReads(queryClient, current);
    }
  });
}

function changed(before: Operation, current: Operation): boolean {
  return before.state !== current.state || before.stage !== current.stage || before.error?.outcome !== current.error?.outcome;
}
