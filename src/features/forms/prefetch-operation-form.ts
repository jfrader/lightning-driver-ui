import type { QueryClient } from '@tanstack/react-query';
import { feeEstimatesQueryOptions, nodePolicyQueryOptions } from '../../api/node-queries';
import type { OperationKind } from '../../api/types';

export async function prefetchOperationForm(queryClient: QueryClient, nodeId: string, kind: OperationKind) {
  const policy = queryClient.prefetchQuery(nodePolicyQueryOptions(nodeId));
  const estimates = ['open_channel', 'close_channel', 'send_onchain'].includes(kind)
    ? queryClient.prefetchQuery(feeEstimatesQueryOptions(nodeId))
    : undefined;
  await Promise.all([policy, estimates]);
}
