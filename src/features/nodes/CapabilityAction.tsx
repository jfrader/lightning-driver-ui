import type { ReactNode } from 'react';
import { Button, Flex, styled } from '@jfrader/ui';
import type { CapabilityKey, NodeSummary } from '../../api/types';
import { CAPABILITY_LABEL, capabilityBlock, capabilityReasonText } from './labels';

const Reason = styled.span(({ theme }) => ({ color: theme.color.textMuted, fontSize: theme.textSize.sm }));

interface CapabilityActionProps {
  node: NodeSummary;
  capability: CapabilityKey;
  /** The enabled entry point, usually a ButtonLink. */
  children: ReactNode;
}

/**
 * Hides mutation entries on read-only nodes; otherwise a blocked entry stays visible, disabled, with
 * its reason as adjacent text (never a tooltip).
 */
export function CapabilityAction({ node, capability, children }: CapabilityActionProps) {
  const reason = capabilityBlock(node, capability);
  if (reason === null) return children;
  if (reason === 'read_only' || reason === 'monitor_only') return null;
  return (
    <Flex direction="column" gap="xs">
      <Button size="sm" variant="outline" disabled>
        {CAPABILITY_LABEL[capability]}
      </Button>
      <Reason>{capabilityReasonText(reason, node)}</Reason>
    </Flex>
  );
}
