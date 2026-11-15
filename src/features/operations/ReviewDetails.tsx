import { Mono } from '../../components/text';
import { Disclosure } from '../../components/Disclosure';
import type { DecodedInvoice, Operation } from '../../api/types';
import { DetailList, type DetailItem } from '../../components/DetailList';
import { UtcTime } from '../../components/UtcTime';
import { Identifier } from '../display/Identifier';
import { NotReported } from '../display/NotReported';

interface ReviewDetailsProps {
  operation: Operation;
  /** The re-decoded invoice of a payment review; `null` when it was not checked here. */
  decoded?: DecodedInvoice | null;
}

/** Technical identifiers of a review, collapsed so they never compete with the amount. */
export function ReviewDetails({ operation, decoded = null }: ReviewDetailsProps) {
  const { review, error } = operation;
  const items: (DetailItem | false)[] = [
    review.payment_hash !== null && {
      label: 'Payment hash',
      stacked: true,
      value: <Identifier value={review.payment_hash} label="Payment hash" />,
    },
    { label: 'Node public key', stacked: true, value: <Identifier value={review.node.identity_pubkey} label="Node public key" /> },
    { label: 'Review digest', stacked: true, value: <Identifier value={review.digest} label="Review digest" /> },
    { label: 'Operation ID', value: <Mono size="sm" wrap>{review.operation_id}</Mono> },
    error !== null && { label: 'Request ID', value: <Mono size="sm" wrap>{error.request_id}</Mono> },
    { label: 'Node binding', value: <Mono size="sm" wrap>{review.node.identity_revision}</Mono> },
    { label: 'Policy revision', value: <Mono size="sm" wrap>{review.policy_revision}</Mono> },
    { label: 'Review expires', value: <UtcTime value={review.expires_at} /> },
    operation.request.kind === 'pay_invoice' && {
      label: 'Invoice expires',
      value: decoded ? <UtcTime value={decoded.expires_at} /> : <NotReported>Not checked</NotReported>,
    },
  ];
  const facts = <DetailList items={items.filter((item): item is DetailItem => item !== false)} />;
  return (
    <Disclosure value="technical" label="Technical details">
      {facts}
    </Disclosure>
  );
}
