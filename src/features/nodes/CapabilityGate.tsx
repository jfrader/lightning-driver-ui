import type { ReactNode } from 'react';
import { Alert, Flex } from '@jfrader/ui';
import type { CapabilityKey, NodeSummary } from '../../api/types';
import { capabilityBlock, capabilityReasonText } from './labels';

interface CapabilityGateProps {
  node: NodeSummary;
  capability: CapabilityKey;
  /** The way back when the form cannot render, e.g. "Back to channels". */
  back: ReactNode;
  children: ReactNode;
}

/** Guards a form route: a blocked action renders its reason and the way back, never any field. */
export function CapabilityGate({ node, capability, back, children }: CapabilityGateProps) {
  const reason = capabilityBlock(node, capability);
  if (reason === null) return children;
  return (
    <Flex direction="column" gap="md" align="start">
      <Alert tone="info" title={capabilityReasonText(reason, node)} />
      {back}
    </Flex>
  );
}
