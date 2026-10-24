import type { NodeSummary, Operation } from '../../api/types';
import { PaymentReview } from '../payments/review/PaymentReview';
import { OperationDetail } from './OperationDetail';
import { KindReview } from './review/KindReview';

export function OperationView({ operation, node, unanswered = false, stale = false }: { operation: Operation; node: NodeSummary | null; unanswered?: boolean; stale?: boolean }) {
  if (operation.state !== 'awaiting_confirmation' || unanswered || stale) {
    return <OperationDetail operation={operation} node={node} unanswered={unanswered} />;
  }
  if (operation.request.kind === 'pay_invoice') {
    return <PaymentReview key={operation.id} operation={operation} bolt11={operation.request.params.bolt11} node={node} />;
  }
  return <KindReview key={operation.id} operation={operation} node={node} />;
}
