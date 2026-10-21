import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, notFound } from '@tanstack/react-router';
import { nodeQueryOptions } from '../../api/node-queries';
import type { NodeSummary } from '../../api/types';

const nodeRoute = getRouteApi('/_authed/nodes/$nodeId');

/** The node selected by the URL, or `null` for a former node that only has operation history. */
export function useNodeLookup(): { nodeId: string; node: NodeSummary | null } {
  const { nodeId } = nodeRoute.useParams();
  return { nodeId, node: useSuspenseQuery(nodeQueryOptions(nodeId)).data };
}

/** The configured node selected by the URL. There is no other notion of an active node. */
export function useCurrentNode(): NodeSummary {
  const { node } = useNodeLookup();
  if (!node) throw notFound();
  return node;
}
