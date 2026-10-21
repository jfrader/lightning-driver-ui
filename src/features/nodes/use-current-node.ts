import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { nodeQueryOptions } from '../../api/node-queries';
import type { NodeSummary } from '../../api/types';

const nodeRoute = getRouteApi('/_authed/nodes/$nodeId');

/** The node selected by the URL. There is no other notion of an active node. */
export function useCurrentNode(): NodeSummary {
  const { nodeId } = nodeRoute.useParams();
  return useSuspenseQuery(nodeQueryOptions(nodeId)).data;
}
