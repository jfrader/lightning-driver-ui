import type { Operation } from '../../api/types';
import { CopyValue } from '../../components/CopyValue';
import { DetailList, type DetailItem } from '../../components/DetailList';
import { formatDateTime } from '../../lib/time';
import { Amount } from '../display/Amount';
import { NETWORK_LABEL } from '../nodes/labels';
import { OPERATION_KIND } from './labels';

const FEE_CONTROL: Record<Operation['review']['fee']['control'], string> = {
  none: 'No fee',
  absolute_routing_limit: 'Hard limit on routing fees',
  requested_onchain_rate: 'Requested rate; the final fee can differ',
  cooperative_negotiation: 'Negotiated with the peer; the total fee is not fixed',
};

function requestItems(request: Operation['request']): DetailItem[] {
  switch (request.kind) {
    case 'create_invoice':
      return [
        { label: 'Description', value: request.params.description || 'None' },
        { label: 'Expires after', value: `${request.params.expiry_seconds} s` },
      ];
    case 'pay_invoice':
      return [{ label: 'Invoice', value: <CopyValue value={request.params.bolt11} label="Invoice" /> }];
    case 'connect_peer':
      return [{ label: 'Address', value: `${request.params.host}:${request.params.port}` }];
    case 'open_channel':
      return [{ label: 'Visibility', value: request.params.private ? 'Private' : 'Public' }];
    case 'new_address':
      return [{ label: 'Address type', value: 'Native SegWit (P2WPKH)' }];
    case 'disconnect_peer':
    case 'close_channel':
    case 'send_onchain':
      return [];
  }
}

/** Renders only the immutable server review, never local form values. */
export function OperationReviewDetails({ operation }: { operation: Operation }) {
  const { review, request } = operation;
  const { fee } = review;
  const items: (DetailItem | false)[] = [
    { label: 'Action', value: OPERATION_KIND[request.kind] },
    { label: 'Node', value: <CopyValue value={review.node.node_id} label="Node ID" /> },
    { label: 'Network', value: NETWORK_LABEL[review.node.network] },
    { label: 'Node public key', value: <CopyValue value={review.node.identity_pubkey} label="Node public key" /> },
    review.amount_msat !== null && { label: 'Amount', value: <Amount value={review.amount_msat} unit="msat" /> },
    review.amount_msat === null &&
      review.amount_sat !== null && { label: 'Amount', value: <Amount value={review.amount_sat} unit="sat" /> },
    review.destination !== null && { label: 'Destination', value: <CopyValue value={review.destination} label="Destination" /> },
    review.peer_pubkey !== null && { label: 'Peer', value: <CopyValue value={review.peer_pubkey} label="Peer" /> },
    review.channel_id !== null && { label: 'Channel', value: <CopyValue value={review.channel_id} label="Channel ID" /> },
    review.payment_hash !== null && {
      label: 'Payment hash',
      value: <CopyValue value={review.payment_hash} label="Payment hash" />,
    },
    ...requestItems(request),
    { label: 'Fee', value: FEE_CONTROL[fee.control] },
    fee.max_fee_msat !== null && { label: 'Maximum fee', value: <Amount value={fee.max_fee_msat} unit="msat" /> },
    fee.fee_rate_sat_vbyte !== null && { label: 'Fee rate', value: `${fee.fee_rate_sat_vbyte} sat/vB` },
    fee.fee_estimate_sat !== null && {
      label: 'Estimated fee',
      value: <Amount value={fee.fee_estimate_sat} unit="sat" />,
    },
    { label: 'Review expires', value: formatDateTime(review.expires_at) ?? review.expires_at },
    { label: 'Review digest', value: <CopyValue value={review.digest} label="Review digest" /> },
  ];
  return <DetailList items={items.filter((item): item is DetailItem => item !== false)} />;
}
