import { queryOptions } from '@tanstack/react-query';
import { NODE_REFRESH_MS, PAGE_LIMIT } from '../config';
import { apiRequest, expectNode, nodePath } from './client';
import { ContractError } from './errors';
import * as validators from './generated/validators';
import { nodeKeys } from './node-queries';

function read<T>(
  nodeId: string,
  segments: string[],
  response: validators.ContractValidator<T>,
  signal: AbortSignal,
  query?: Record<string, string | number | undefined>,
) {
  return apiRequest({ method: 'GET', path: nodePath(nodeId, ...segments), response, signal, query });
}

function detail<T extends { node_id: string | null }>(
  resource: string,
  segments: string[],
  response: validators.ContractValidator<T>,
) {
  return (nodeId: string) =>
    queryOptions({
      queryKey: nodeKeys.detail(nodeId, resource),
      queryFn: async ({ signal }) => {
        const value = await read(nodeId, segments, response, signal);
        return expectNode(nodePath(nodeId, ...segments), nodeId, value.node_id, value);
      },
      refetchInterval: NODE_REFRESH_MS,
    });
}

function list<T extends { node_id: string | null }>(
  resource: string,
  segments: string[],
  response: validators.ContractValidator<T>,
) {
  return (nodeId: string, cursor?: string) =>
    queryOptions({
      queryKey: nodeKeys.list(nodeId, resource, { cursor, limit: String(PAGE_LIMIT) }),
      queryFn: async ({ signal }) => {
        const value = await read(nodeId, segments, response, signal, { cursor, limit: PAGE_LIMIT });
        return expectNode(nodePath(nodeId, ...segments), nodeId, value.node_id, value);
      },
    });
}

export const bitcoinQueryOptions = detail('bitcoin', ['bitcoin'], validators.BitcoinNodeInfo);
export const bitcoinPeersQueryOptions = list('bitcoin-peers', ['bitcoin', 'peers'], validators.BitcoinPeersPage);
export const watchtowerServerQueryOptions = detail(
  'watchtower-server',
  ['watchtower', 'server'],
  validators.WatchtowerServerInfo,
);
export const watchtowerClientQueryOptions = detail(
  'watchtower-client',
  ['watchtower', 'client'],
  validators.WatchtowerClientInfo,
);
export const watchtowerTowersQueryOptions = list(
  'watchtower-towers',
  ['watchtower', 'client', 'towers'],
  validators.WatchtowerTowersPage,
);
export const watchtowerTowerQueryOptions = (nodeId: string, pubkey: string) =>
  queryOptions({
    queryKey: nodeKeys.detail(nodeId, `watchtower-tower-${pubkey}`),
    queryFn: async ({ signal }) => {
      const segments = ['watchtower', 'client', 'towers', pubkey];
      const tower = await read(nodeId, segments, validators.WatchtowerTowerDetail, signal);
      if (tower.pubkey !== pubkey)
        throw new ContractError(nodePath(nodeId, ...segments), 'response is for another tower');
      return tower;
    },
  });
