import type { NodeSummary, Operation } from '../../api/types';
import { PaymentReview } from '../payments/review/PaymentReview';
import { OperationDetail } from './OperationDetail';
import { KindReview } from './review/KindReview';

export function OperationView({ operation, node, unanswered = false }: { operation: Operation; node: NodeSummary | null; unanswered?: boolean }) {
  if (operation.state !== 'awaiting_confirmation' || unanswered) {
    return <OperationDetail operation={operation} node={node} unanswered={unanswered} />;
  }
  if (operation.request.kind === 'pay_invoice') {
    return <PaymentReview key={operation.id} operation={operation} bolt11={operation.request.params.bolt11} node={node} />;
  }
  return <KindReview key={operation.id} operation={operation} node={node} />;
}
