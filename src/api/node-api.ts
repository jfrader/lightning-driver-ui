import { apiRequest, expectNode, nodePath } from './client';
import type { ContractValidator } from './generated/validators';
import {
  Balances,
  ChannelsPage,
  DecodedInvoice,
  FeeEstimates,
  InvoicesPage,
  NodeInfo,
  NodePolicy,
  NodeStatus,
  NodeSummary,
  NodesPage,
  OperationsPage,
  PaymentsPage,
  PeersPage,
  TransactionsPage,
} from './generated/validators';

type Query = Record<string, string | number | undefined>;

export function listNodes(cursor: string | undefined, signal?: AbortSignal) {
  return apiRequest({ method: 'GET', path: '/nodes', query: { cursor }, response: NodesPage, signal });
}

export async function getNode(nodeId: string, signal?: AbortSignal) {
  const path = nodePath(nodeId);
  const node = await apiRequest({ method: 'GET', path, response: NodeSummary, signal });
  return expectNode(path, nodeId, node.id, node);
}

async function getNodeResource<T extends { node_id: string | null }>(
  nodeId: string,
  resource: string,
  response: ContractValidator<T>,
  signal: AbortSignal | undefined,
  query?: Query,
): Promise<T> {
  const path = nodePath(nodeId, resource);
  const data = await apiRequest({ method: 'GET', path, query, response, signal });
  return expectNode(path, nodeId, data.node_id, data);
}

export async function getNodeInfo(nodeId: string, signal?: AbortSignal) {
  const path = nodePath(nodeId, 'info');
  const info = await apiRequest({ method: 'GET', path, response: NodeInfo, signal });
  return expectNode(path, nodeId, info.node.id, info);
}

export const getNodeStatus = (nodeId: string, signal?: AbortSignal) =>
  getNodeResource(nodeId, 'status', NodeStatus, signal);
export const getNodePolicy = (nodeId: string, signal?: AbortSignal) =>
  getNodeResource(nodeId, 'policy', NodePolicy, signal);
export const getFeeEstimates = (nodeId: string, signal?: AbortSignal) =>
  getNodeResource(nodeId, 'fee-estimates', FeeEstimates, signal);
export const getBalances = (nodeId: string, signal?: AbortSignal) =>
  getNodeResource(nodeId, 'balances', Balances, signal);

export const listInvoices = (nodeId: string, query: Query, signal?: AbortSignal) =>
  getNodeResource(nodeId, 'invoices', InvoicesPage, signal, query);
export const listPayments = (nodeId: string, query: Query, signal?: AbortSignal) =>
  getNodeResource(nodeId, 'payments', PaymentsPage, signal, query);
export const listPeers = (nodeId: string, query: Query, signal?: AbortSignal) =>
  getNodeResource(nodeId, 'peers', PeersPage, signal, query);
export const listChannels = (nodeId: string, query: Query, signal?: AbortSignal) =>
  getNodeResource(nodeId, 'channels', ChannelsPage, signal, query);
export const listTransactions = (nodeId: string, query: Query, signal?: AbortSignal) =>
  getNodeResource(nodeId, 'transactions', TransactionsPage, signal, query);
export const listOperations = (nodeId: string, query: Query, signal?: AbortSignal) =>
  getNodeResource(nodeId, 'operations', OperationsPage, signal, query);

/** Local BOLT11 decode. Works on read-only nodes and never touches the node. */
export function decodeInvoice(nodeId: string, bolt11: string) {
  return apiRequest({
    method: 'POST',
    path: nodePath(nodeId, 'decode'),
    body: { bolt11 },
    response: DecodedInvoice,
  });
}
