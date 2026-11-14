import { useId, type ReactNode } from 'react';
import { Button, Flex, styled } from '@jfrader/ui';
import type { CapabilityKey, NodeSummary } from '../../api/types';
import { CAPABILITY_LABEL, capabilityBlock, capabilityReasonText } from './labels';
import { ACTION_SURFACES, surfacesFor } from '../shell/nav-model';
import { useControlSize } from '../shell/use-shell-layout';
import { wrappingControlText } from '../../components/control-styles';

const Reason = styled.span(({ theme }) => ({ color: theme.color.textMuted, fontSize: theme.textSize.sm }));

/** The one visible reason a caller renders for a group of actions blocked by the same cause. */
export const CapabilityReason = Reason;

interface CapabilityActionProps {
  node: NodeSummary;
  capability: CapabilityKey;
  /** The enabled entry point, usually a ButtonLink. */
  children: ReactNode;
  showUnavailable?: boolean;
  /** The id of one visible reason the caller already renders for several blocked actions. */
  describedBy?: string;
}

/**
 * A blocked entry stays visible, disabled, with
 * its reason as adjacent text (never a tooltip).
 */
export function CapabilityAction({ node, capability, children, showUnavailable = false, describedBy }: CapabilityActionProps) {
  const localReasonId = useId();
  const reasonId = describedBy ?? localReasonId;
  const size = useControlSize();
  if (!showUnavailable && !surfacesFor(node).includes(ACTION_SURFACES[capability])) return null;
  const reason = capabilityBlock(node, capability);
  if (reason === null) return children;
  if (!showUnavailable && reason === 'monitor_only') return null;
  return (
    <Flex direction="column" gap="xs">
      <Button size={size} variant="outline" sx={wrappingControlText(size)} disabled aria-describedby={reasonId}>
        {CAPABILITY_LABEL[capability]}
      </Button>
      {!describedBy && <Reason id={reasonId}>{capabilityReasonText(reason, node)}</Reason>}
    </Flex>
  );
}
