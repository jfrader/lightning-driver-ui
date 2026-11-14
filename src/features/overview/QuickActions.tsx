import { styled } from '@jfrader/ui';
import { useId } from 'react';
import type { NodeSummary } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { TABLE_MEDIA } from '../../config';
import { CapabilityAction, CapabilityReason } from '../nodes/CapabilityAction';
import { capabilityBlock, capabilityReasonText } from '../nodes/labels';
import { useControlSize } from '../shell/use-shell-layout';
import { MoneyActionButton } from '../shell/MoneyActionButton';

const Bar = styled.div(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  gap: theme.space[2],
  '& > a, & > button': { flex: '1 1 auto' },
  [TABLE_MEDIA]: { '& > a, & > button': { flex: '0 1 auto' } },
}));

/** A group reason spans the whole action bar, below the controls it describes. */
const SharedReason = styled.div({ flexBasis: '100%' });

const ACTIONS = ['pay_invoice', 'create_invoice', 'new_address', 'send_onchain', 'open_channel'] as const;

const Secondary = styled.div(({ theme }) => ({
  flexBasis: '100%',
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space[2],
  [TABLE_MEDIA]: {
    flexBasis: 'auto',
    paddingInlineStart: theme.space[3],
    marginInlineStart: theme.space[1],
    borderInlineStart: `1px solid ${theme.color.border}`,
  },
}));

/**
 * One accent priority (Pay invoice); Receive is outline and the rest are text actions. Every entry
 * only opens a form and obeys the node's capabilities.
 */
export function QuickActions({ node }: { node: NodeSummary }) {
  const size = useControlSize();
  const params = { nodeId: node.id };
  const reasonId = useId();
  // One cause for every action (a read-only node, a syncing node) is one sentence, not five.
  const blocks = ACTIONS.map((capability) => capabilityBlock(node, capability));
  const shared = blocks.every((reason) => reason !== null && reason === blocks[0]) ? blocks[0] : null;
  const describedBy = shared ? reasonId : undefined;
  return (
    <Bar>
      <CapabilityAction node={node} capability="pay_invoice" describedBy={describedBy}>
        <MoneyActionButton action="pay_invoice" size={size} tone="accent" variant="solid">
          Pay invoice
        </MoneyActionButton>
      </CapabilityAction>
      <CapabilityAction node={node} capability="create_invoice" describedBy={describedBy}>
        <MoneyActionButton action="create_invoice" size={size} variant="outline">
          Receive
        </MoneyActionButton>
      </CapabilityAction>
      <Secondary>
        <CapabilityAction node={node} capability="new_address" describedBy={describedBy}>
          <MoneyActionButton action="new_address" size={size} variant="ghost">
            New address
          </MoneyActionButton>
        </CapabilityAction>
        <CapabilityAction node={node} capability="send_onchain" describedBy={describedBy}>
          <MoneyActionButton action="send_onchain" size={size} variant="ghost">
            Send on-chain
          </MoneyActionButton>
        </CapabilityAction>
        <CapabilityAction node={node} capability="open_channel" describedBy={describedBy}>
          <ButtonLink to="/nodes/$nodeId/channels/new" params={params} size={size} variant="ghost">
            Open channel
          </ButtonLink>
        </CapabilityAction>
      </Secondary>
      {shared && <SharedReason><CapabilityReason id={reasonId}>{capabilityReasonText(shared, node)}</CapabilityReason></SharedReason>}
    </Bar>
  );
}
