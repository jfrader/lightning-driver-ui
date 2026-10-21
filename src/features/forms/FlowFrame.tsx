import type { ReactNode } from 'react';
import { Flex } from '@jfrader/ui';
import type { CapabilityKey, NodePolicy, NodeSummary } from '../../api/types';
import { PageHeader } from '../../components/PageHeader';
import { CapabilityGate } from '../nodes/CapabilityGate';
import { useCurrentNode } from '../nodes/use-current-node';
import { PolicyLoader } from './PolicyLoader';

interface FlowFrameProps {
  title: string;
  capability: CapabilityKey;
  children: (context: { node: NodeSummary; policy: NodePolicy }) => ReactNode;
}

/** Full-page mutation form: capability gate first, then the node's server policy. */
export function FlowFrame({ title, capability, children }: FlowFrameProps) {
  const node = useCurrentNode();
  return (
    <Flex direction="column" gap="md">
      <PageHeader title={title} />
      <CapabilityGate node={node} capability={capability}>
        <PolicyLoader nodeId={node.id}>{(policy) => children({ node, policy })}</PolicyLoader>
      </CapabilityGate>
    </Flex>
  );
}
