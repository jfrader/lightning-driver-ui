import { ConfiguredNodeLayout } from './ConfiguredNodeLayout';
import { FormerNodeLayout } from './FormerNodeLayout';
import { useNodeLookup } from './use-current-node';

/** Configured nodes get the full workspace; former nodes only their operation history. */
export function NodeLayout() {
  const { nodeId, node } = useNodeLookup();
  return node ? <ConfiguredNodeLayout node={node} /> : <FormerNodeLayout nodeId={nodeId} />;
}
