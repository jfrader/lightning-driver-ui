import { styled } from '@jfrader/ui';
import type { NodeSummary } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { TABLE_MEDIA } from '../../config';
import { CapabilityAction } from '../nodes/CapabilityAction';
import { useControlSize } from '../shell/use-shell-layout';

const Bar = styled.div(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  gap: theme.space[2],
  '& > a': { flex: '1 1 auto' },
  [TABLE_MEDIA]: { '& > a': { flex: '0 1 auto' } },
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
 * only opens a form and obeys the node's capabilities; read-only nodes show none.
 */
export function QuickActions({ node }: { node: NodeSummary }) {
  const size = useControlSize();
  if (node.read_only) return null;
  const params = { nodeId: node.id };
  return (
    <Bar>
      <CapabilityAction node={node} capability="pay_invoice">
        <ButtonLink to="/nodes/$nodeId/payments/new" params={params} size={size} tone="accent" variant="solid">
          Pay invoice
        </ButtonLink>
      </CapabilityAction>
      <CapabilityAction node={node} capability="create_invoice">
        <ButtonLink to="/nodes/$nodeId/invoices/new" params={params} size={size} variant="outline">
          Receive
        </ButtonLink>
      </CapabilityAction>
      <Secondary>
        <CapabilityAction node={node} capability="new_address">
          <ButtonLink to="/nodes/$nodeId/onchain/receive" params={params} size={size} variant="ghost">
            New address
          </ButtonLink>
        </CapabilityAction>
        <CapabilityAction node={node} capability="send_onchain">
          <ButtonLink to="/nodes/$nodeId/onchain/send" params={params} size={size} variant="ghost">
            Send on-chain
          </ButtonLink>
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
