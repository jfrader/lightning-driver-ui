import { Accordion, styled } from '@jfrader/ui';
import type { DecodedInvoice, Operation } from '../../../api/types';
import { DetailList } from '../../../components/DetailList';
import { UtcTime } from '../../../components/UtcTime';
import { Identifier } from '../../display/Identifier';
import { NotReported } from '../../display/NotReported';

const Mono = styled.span(({ theme }) => ({ fontFamily: theme.font.mono, fontSize: theme.textSize.sm, overflowWrap: 'anywhere' }));

interface ReviewDetailsProps {
  operation: Operation;
  decoded: DecodedInvoice | null;
}

/** Technical identifiers of the review, collapsed so they never compete with the amount. */
export function ReviewDetails({ operation, decoded }: ReviewDetailsProps) {
  const { review } = operation;
  const facts = (
    <DetailList
      items={[
        {
          label: 'Payment hash',
          stacked: true,
          value: review.payment_hash ? <Identifier value={review.payment_hash} label="Payment hash" /> : <NotReported />,
        },
        { label: 'Node public key', stacked: true, value: <Identifier value={review.node.identity_pubkey} label="Node public key" /> },
        { label: 'Review digest', stacked: true, value: <Identifier value={review.digest} label="Review digest" /> },
        { label: 'Operation ID', value: <Mono>{review.operation_id}</Mono> },
        { label: 'Node binding', value: <Mono>{review.node.identity_revision}</Mono> },
        { label: 'Policy revision', value: <Mono>{review.policy_revision}</Mono> },
        { label: 'Review expires', value: <UtcTime value={review.expires_at} /> },
        { label: 'Invoice expires', value: decoded ? <UtcTime value={decoded.expires_at} /> : <NotReported>Not checked</NotReported> },
      ]}
    />
  );
  return <Accordion collapsible items={[{ value: 'technical', label: 'Technical details', panel: facts }]} />;
}
