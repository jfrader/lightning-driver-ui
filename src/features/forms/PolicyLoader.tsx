import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { nodePolicyQueryOptions } from '../../api/node-queries';
import type { NodePolicy } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { LoadingState } from '../../components/LoadingState';

interface PolicyLoaderProps {
  nodeId: string;
  children: (policy: NodePolicy) => ReactNode;
}

export function PolicyLoader({ nodeId, children }: PolicyLoaderProps) {
  const policy = useQuery(nodePolicyQueryOptions(nodeId));
  if (policy.isPending) return <LoadingState label="Loading node limits" />;
  if (policy.isError) return <ErrorNotice error={policy.error} onRetry={() => void policy.refetch()} />;
  return children(policy.data);
}
