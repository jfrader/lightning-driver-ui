import { queryOptions, skipToken, type QueryClient } from '@tanstack/react-query';
import { useCachedQueryData } from '../../api/use-cached-query-data';

/**
 * Operations whose confirm request has been sent and not answered yet. Kept in the query cache so a
 * session-loss clear drops it with everything else; never fetched, never persisted.
 */
const confirming = queryOptions<readonly string[]>({ queryKey: ['confirming'], queryFn: skipToken });

export function markConfirmSent(queryClient: QueryClient, operationId: string): void {
  queryClient.setQueryData(confirming.queryKey, (ids = []) => [...ids, operationId]);
}

export function markConfirmAnswered(queryClient: QueryClient, operationId: string): void {
  // After a session-loss clear there is nothing to update, and nothing may be re-created.
  if (queryClient.getQueryData(confirming.queryKey) === undefined) return;
  queryClient.setQueryData(confirming.queryKey, (ids = []) => ids.filter((id) => id !== operationId));
}

/** True while any confirm request is in flight: node switching stays locked until it answers. */
export function useConfirmInFlight(): boolean {
  return (useCachedQueryData(confirming.queryKey)?.length ?? 0) > 0;
}
