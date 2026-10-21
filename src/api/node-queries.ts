import { queryOptions } from '@tanstack/react-query';
import { NODE_REFRESH_MS } from '../config';
import { errorCode } from './errors';
import {
  getBalances,
  getFeeEstimates,
  getNode,
  getNodeInfo,
  getNodePolicy,
  listChannels,
  listInvoices,
  listNodes,
  listOperations,
  listPayments,
  listPeers,
  listTransactions,
} from './node-api';
import { getOperation } from './operation-api';

type ListParams = Record<string, string | undefined>;

/** Every node read lives under `['node', nodeId, …]`, so one node's cache never answers for another. */
export const nodeKeys = {
  all: (nodeId: string) => ['node', nodeId] as const,
  summary: (nodeId: string) => ['node', nodeId, 'summary'] as const,
  detail: (nodeId: string, resource: string) => ['node', nodeId, resource] as const,
  list: (nodeId: string, resource: string, params: ListParams) => ['node', nodeId, resource, params] as const,
  operation: (nodeId: string, operationId: string) => ['node', nodeId, 'operation', operationId] as const,
};

export const fleetQueryOptions = (cursor?: string) =>
  queryOptions({
    queryKey: ['fleet', { cursor }],
    queryFn: ({ signal }) => listNodes(cursor, signal),
    refetchInterval: NODE_REFRESH_MS,
  });

/**
 * The node's current registry entry, or `null` when the server no longer configures this ID.
 * A former node keeps its read-only operation history; it never becomes writable here.
 */
export const nodeQueryOptions = (nodeId: string) =>
  queryOptions({
    queryKey: nodeKeys.summary(nodeId),
    queryFn: ({ signal }) =>
      getNode(nodeId, signal).catch((error: unknown) => {
        if (errorCode(error) === 'not_found') return null;
        throw error;
      }),
    refetchInterval: NODE_REFRESH_MS,
  });

export const nodeInfoQueryOptions = (nodeId: string) =>
  queryOptions({ queryKey: nodeKeys.detail(nodeId, 'info'), queryFn: ({ signal }) => getNodeInfo(nodeId, signal) });

export const balancesQueryOptions = (nodeId: string) =>
  queryOptions({
    queryKey: nodeKeys.detail(nodeId, 'balances'),
    queryFn: ({ signal }) => getBalances(nodeId, signal),
    refetchInterval: NODE_REFRESH_MS,
  });

export const nodePolicyQueryOptions = (nodeId: string) =>
  queryOptions({ queryKey: nodeKeys.detail(nodeId, 'policy'), queryFn: ({ signal }) => getNodePolicy(nodeId, signal) });

export const feeEstimatesQueryOptions = (nodeId: string) =>
  queryOptions({
    queryKey: nodeKeys.detail(nodeId, 'fee-estimates'),
    queryFn: ({ signal }) => getFeeEstimates(nodeId, signal),
  });

const listQuery = <T>(
  resource: string,
  fetchPage: (nodeId: string, params: ListParams, signal: AbortSignal) => Promise<T>,
) =>
  (nodeId: string, params: ListParams) =>
    queryOptions({
      queryKey: nodeKeys.list(nodeId, resource, params),
      queryFn: ({ signal }) => fetchPage(nodeId, params, signal),
    });

export const invoicesQueryOptions = listQuery('invoices', listInvoices);
export const paymentsQueryOptions = listQuery('payments', listPayments);
export const peersQueryOptions = listQuery('peers', listPeers);
export const channelsQueryOptions = listQuery('channels', listChannels);
export const transactionsQueryOptions = listQuery('transactions', listTransactions);
export const operationsQueryOptions = listQuery('operations', listOperations);

export const operationQueryOptions = (nodeId: string, operationId: string) =>
  queryOptions({
    queryKey: nodeKeys.operation(nodeId, operationId),
    queryFn: ({ signal }) => getOperation(nodeId, operationId, signal),
  });
