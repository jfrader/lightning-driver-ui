import { useCallback, useSyncExternalStore } from 'react';
import { useQueryClient, type DataTag, type QueryKey } from '@tanstack/react-query';

/**
 * Data already cached under `queryKey`, read without creating a cache entry or a fetch. For
 * components that only display a read another component owns: after a session-loss clear they
 * cannot re-add an entry while they are still on screen.
 */
export function useCachedQueryData<TData, TError>(queryKey: DataTag<QueryKey, TData, TError> | null): TData | undefined {
  const queryClient = useQueryClient();
  const subscribe = useCallback((onChange: () => void) => queryClient.getQueryCache().subscribe(onChange), [queryClient]);
  return useSyncExternalStore(subscribe, () => (queryKey === null ? undefined : queryClient.getQueryData(queryKey)));
}
