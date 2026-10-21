import type { ReactNode } from 'react';
import { Alert, Flex } from '@jfrader/ui';
import type { CapabilityKey, CapabilityReason, NodeSummary } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { CAPABILITY_REASON } from './labels';

interface CapabilityGateProps {
  node: NodeSummary;
  capability: CapabilityKey;
  children: ReactNode;
}

/** Guards a mutation flow route. Read-only and unavailable nodes never render the form. */
export function CapabilityGate({ node, capability, children }: CapabilityGateProps) {
  const state = node.capabilities[capability];
  if (!node.read_only && state.enabled) return children;
  const reason: CapabilityReason = node.read_only || state.enabled ? 'read_only' : state.reason;
  return (
    <Flex direction="column" gap="md" align="start">
      <Alert tone={reason === 'read_only' ? 'info' : 'warning'} title={CAPABILITY_REASON[reason]}>
        This action is not available for {node.label}.
      </Alert>
      <ButtonLink to="/nodes/$nodeId" params={{ nodeId: node.id }} variant="outline">
        Back to node
      </ButtonLink>
    </Flex>
  );
}
