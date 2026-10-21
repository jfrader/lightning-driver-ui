import type { Operation } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';

const LABEL = 'Start a new review';

/** Back to the form for the same kind of action on the same node. */
export function RestartLink({ operation }: { operation: Operation }) {
  const params = { nodeId: operation.node_id };
  const { request } = operation;
  switch (request.kind) {
    case 'create_invoice':
      return <ButtonLink to="/nodes/$nodeId/invoices/new" params={params} variant="outline">{LABEL}</ButtonLink>;
    case 'pay_invoice':
      return <ButtonLink to="/nodes/$nodeId/payments/new" params={params} variant="outline">{LABEL}</ButtonLink>;
    case 'connect_peer':
      return <ButtonLink to="/nodes/$nodeId/peers/new" params={params} variant="outline">{LABEL}</ButtonLink>;
    case 'disconnect_peer':
      return <ButtonLink to="/nodes/$nodeId/peers" params={params} search={{ cursor: undefined }} variant="outline">Back to peers</ButtonLink>;
    case 'open_channel':
      return <ButtonLink to="/nodes/$nodeId/channels/new" params={params} variant="outline">{LABEL}</ButtonLink>;
    case 'close_channel':
      return (
        <ButtonLink
          to="/nodes/$nodeId/channels/$channelId/close"
          params={{ ...params, channelId: request.params.channel_id }}
          variant="outline"
        >
          {LABEL}
        </ButtonLink>
      );
    case 'new_address':
      return <ButtonLink to="/nodes/$nodeId/onchain/receive" params={params} variant="outline">{LABEL}</ButtonLink>;
    case 'send_onchain':
      return <ButtonLink to="/nodes/$nodeId/onchain/send" params={params} variant="outline">{LABEL}</ButtonLink>;
  }
}
