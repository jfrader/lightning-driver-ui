import { useId, type ReactNode } from 'react';
import { Button, Flex, styled } from '@jfrader/ui';
import type { CapabilityKey, NodeSummary } from '../../api/types';
import { CAPABILITY_LABEL, capabilityBlock, capabilityReasonText } from './labels';
import { ACTION_SURFACES, surfacesFor } from '../shell/nav-model';
import { useControlSize } from '../shell/use-shell-layout';
import { wrappingControlText } from '../../components/control-styles';

const Reason = styled.span(({ theme }) => ({ color: theme.color.textMuted, fontSize: theme.textSize.sm }));

interface CapabilityActionProps {
  node: NodeSummary;
  capability: CapabilityKey;
  /** The enabled entry point, usually a ButtonLink. */
  children: ReactNode;
}

/**
 * A blocked entry stays visible, disabled, with
 * its reason as adjacent text (never a tooltip).
 */
export function CapabilityAction({ node, capability, children }: CapabilityActionProps) {
  const reasonId = useId();
  const size = useControlSize();
  if (!surfacesFor(node).includes(ACTION_SURFACES[capability])) return null;
  const reason = capabilityBlock(node, capability);
  if (reason === null) return children;
  if (reason === 'monitor_only') return null;
  return (
    <Flex direction="column" gap="xs">
      <Button size={size} variant="outline" sx={wrappingControlText(size)} disabled aria-describedby={reasonId}>
        {CAPABILITY_LABEL[capability]}
      </Button>
      <Reason id={reasonId}>{capabilityReasonText(reason, node)}</Reason>
    </Flex>
  );
}
