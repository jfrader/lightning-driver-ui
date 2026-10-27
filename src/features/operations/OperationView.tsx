import type { NodeSummary, Operation } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { PaymentReview } from '../payments/review/PaymentReview';
import { OperationDetail } from './OperationDetail';
import { KindReview } from './review/KindReview';
import { useCreatedConfirmationError } from './use-confirm-operation';

export function OperationView({ operation, node, unanswered = false, stale = false }: { operation: Operation; node: NodeSummary | null; unanswered?: boolean; stale?: boolean }) {
  const creationError = useCreatedConfirmationError(operation.id);
  let content;
  if (operation.state !== 'awaiting_confirmation' || unanswered || stale) {
    content = <OperationDetail operation={operation} node={node} unanswered={unanswered} />;
  } else if (operation.request.kind === 'pay_invoice') {
    content = <PaymentReview key={operation.id} operation={operation} bolt11={operation.request.params.bolt11} node={node} />;
  } else {
    content = <KindReview key={operation.id} operation={operation} node={node} />;
  }
  return <>{creationError && !unanswered && <ErrorNotice error={creationError} />}{content}</>;
}
