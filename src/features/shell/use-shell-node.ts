import { useLocation, useParams } from '@tanstack/react-router';
import { nodeQueryOptions } from '../../api/node-queries';
import { useCachedQueryData } from '../../api/use-cached-query-data';
import type { NodeSummary } from '../../api/types';
import { isNodeId, readRememberedNodeId } from '../nodes/remembered-node';
import { destinationOf, type NodeDestination } from './nav-model';

export interface ShellNode {
  /** The node in the URL; there is no other notion of an active node. */
  nodeId: string | null;
  /** Its registry entry; `null` while loading, for a former node, or off the node workspace. */
  node: NodeSummary | null;
  /** Node the phone tabs open: the URL node, else the last opened one. */
  tabNodeId: string | null;
  destination: NodeDestination | null;
  pathname: string;
}

export function useShellNode(): ShellNode {
  const params = useParams({ strict: false });
  const { pathname } = useLocation();
  const nodeId = isNodeId(params.nodeId) ? params.nodeId : null;
  // The node route owns this read; the shell only displays what it cached.
  const node = useCachedQueryData(nodeId === null ? null : nodeQueryOptions(nodeId).queryKey);
  return {
    nodeId,
    node: node ?? null,
    tabNodeId: nodeId ?? readRememberedNodeId(),
    destination: destinationOf(pathname),
    pathname,
  };
}
