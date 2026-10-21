import { Alert, Flex } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { decodeQueryOptions } from '../../../api/node-queries';
import type { NodeSummary, Operation } from '../../../api/types';
import { LoadingState } from '../../../components/LoadingState';
import { useNow } from '../../../lib/use-now';
import { ConfirmPanel } from '../../operations/ConfirmPanel';
import { confirmBlockReason } from '../../operations/confirm-block';
import { DiscardLink } from '../../operations/review/DiscardLink';
import { ReviewFrame } from '../../operations/review/ReviewFrame';
import { ConsentBlock } from './ConsentBlock';
import { ReviewAside } from './ReviewAside';

interface PaymentReviewProps {
  /** An awaiting `pay_invoice` operation; the review renders only from its server record. */
  operation: Operation;
  /** `request.params.bolt11` of that operation. */
  bolt11: string;
  node: NodeSummary | null;
}

/**
 * The payment review. The invoice is decoded again on every review mount; when the decode fails or
 * its payment hash differs from the server review, no confirm button renders.
 */
export function PaymentReview({ operation, bolt11, node }: PaymentReviewProps) {
  const now = useNow();
  const blocked = confirmBlockReason(operation, node, now);
  const decode = useQuery({ ...decodeQueryOptions(operation.node_id, bolt11), enabled: blocked === null });
  const decoded = decode.data && decode.data.payment_hash === operation.review.payment_hash ? decode.data : null;

  let confirmation;
  if (blocked !== null) {
    confirmation = <ConfirmPanel operation={operation} node={node} />;
  } else if (decode.isPending) {
    confirmation = <LoadingState label="Checking the invoice again" />;
  } else if (!decoded) {
    confirmation = (
      <Flex direction="column" gap="sm" align="start">
        <Alert tone="warning" title="The invoice could not be checked again.">
          Nothing was sent.
        </Alert>
        <DiscardLink operation={operation} sending={false} />
      </Flex>
    );
  } else {
    confirmation = (
      <ConfirmPanel operation={operation} node={node} secondary={(sending) => <DiscardLink operation={operation} sending={sending} />} />
    );
  }

  return (
    <ReviewFrame
      operation={operation}
      title="Review payment"
      consent={<ConsentBlock operation={operation} node={node} decoded={decoded} />}
      confirmation={confirmation}
      aside={<ReviewAside operation={operation} />}
      asideLabel="Payment context"
      decoded={decoded}
    />
  );
}
