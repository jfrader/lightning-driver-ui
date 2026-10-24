import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { operationsQueryOptions } from '../../api/node-queries';
import { publicPolicyQueryOptions } from '../auth/queries';

export function useOperationList(nodeId: string, params: Parameters<typeof operationsQueryOptions>[1]) {
  const policy = useSuspenseQuery(publicPolicyQueryOptions).data;
  return useQuery({
    ...operationsQueryOptions(nodeId, params),
    ...(params.cursor ? { staleTime: Infinity } : {}),
    refetchInterval: params.cursor ? false : policy.operation_poll_seconds * 1000,
    refetchIntervalInBackground: false,
  });
}
