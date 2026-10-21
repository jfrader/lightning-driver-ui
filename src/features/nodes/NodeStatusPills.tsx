import { Flex, Pill } from '@jfrader/ui';
import type { NodeSummary } from '../../api/types';
import { NETWORK_LABEL, NODE_STATUS } from './labels';

/** Network, read-only and connection state of a node, always in words. */
export function NodeStatusPills({ node }: { node: NodeSummary }) {
  const status = NODE_STATUS[node.status.status];
  return (
    <Flex wrap gap="xs" align="center">
      <Pill tone={node.network === 'mainnet' ? 'accent' : 'warning'}>{NETWORK_LABEL[node.network]}</Pill>
      <Pill tone={status.tone}>{status.label}</Pill>
      {node.read_only && <Pill tone="neutral">Read-only</Pill>}
      {node.status.stale && <Pill tone="warning">Stale</Pill>}
    </Flex>
  );
}
