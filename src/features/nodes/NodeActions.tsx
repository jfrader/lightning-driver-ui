import { Flex } from '@jfrader/ui';
import type { NodeSummary } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { Panel } from '../../components/Panel';
import { CapabilityAction } from './CapabilityAction';

/** Entry points to every writable flow. Read-only nodes show none of them. */
export function NodeActions({ node }: { node: NodeSummary }) {
  if (node.read_only) return null;
  const params = { nodeId: node.id };
  return (
    <Panel title="Actions">
      <Flex wrap gap="sm" align="start">
        <CapabilityAction node={node} capability="create_invoice">
          <ButtonLink to="/nodes/$nodeId/invoices/new" params={params} tone="accent">
            Receive
          </ButtonLink>
        </CapabilityAction>
        <CapabilityAction node={node} capability="pay_invoice">
          <ButtonLink to="/nodes/$nodeId/payments/new" params={params} tone="accent">
            Pay invoice
          </ButtonLink>
        </CapabilityAction>
        <CapabilityAction node={node} capability="new_address">
          <ButtonLink to="/nodes/$nodeId/onchain/receive" params={params} variant="outline">
            New address
          </ButtonLink>
        </CapabilityAction>
        <CapabilityAction node={node} capability="send_onchain">
          <ButtonLink to="/nodes/$nodeId/onchain/send" params={params} variant="outline">
            Send on-chain
          </ButtonLink>
        </CapabilityAction>
        <CapabilityAction node={node} capability="open_channel">
          <ButtonLink to="/nodes/$nodeId/channels/new" params={params} variant="outline">
            Open channel
          </ButtonLink>
        </CapabilityAction>
        <CapabilityAction node={node} capability="connect_peer">
          <ButtonLink to="/nodes/$nodeId/peers/new" params={params} variant="outline">
            Connect peer
          </ButtonLink>
        </CapabilityAction>
      </Flex>
    </Panel>
  );
}
