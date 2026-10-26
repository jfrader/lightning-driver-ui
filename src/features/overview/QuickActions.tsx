import { styled } from '@jfrader/ui';
import type { NodeSummary } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { TABLE_MEDIA } from '../../config';
import { CapabilityAction } from '../nodes/CapabilityAction';
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
  return (
    <Bar>
      <CapabilityAction node={node} capability="pay_invoice">
        <MoneyActionButton action="pay_invoice" size={size} tone="accent" variant="solid">
          Pay invoice
        </MoneyActionButton>
      </CapabilityAction>
      <CapabilityAction node={node} capability="create_invoice">
        <MoneyActionButton action="create_invoice" size={size} variant="outline">
          Receive
        </MoneyActionButton>
      </CapabilityAction>
      <Secondary>
        <CapabilityAction node={node} capability="new_address">
          <MoneyActionButton action="new_address" size={size} variant="ghost">
            New address
          </MoneyActionButton>
        </CapabilityAction>
        <CapabilityAction node={node} capability="send_onchain">
          <MoneyActionButton action="send_onchain" size={size} variant="ghost">
            Send on-chain
          </MoneyActionButton>
        </CapabilityAction>
        <CapabilityAction node={node} capability="open_channel">
          <ButtonLink to="/nodes/$nodeId/channels/new" params={params} size={size} variant="ghost">
            Open channel
          </ButtonLink>
        </CapabilityAction>
      </Secondary>
    </Bar>
  );
}
