import type { NodeSummary, Operation } from '../../../api/types';
import { ConfirmPanel } from '../ConfirmPanel';
import { DiscardLink } from './DiscardLink';
import { KindConsent } from './KindConsent';
import { ReviewFrame } from './ReviewFrame';

/** Review screen title per kind. */
const REVIEW_TITLE: Record<Exclude<Operation['request']['kind'], 'pay_invoice'>, string> = {
  create_invoice: 'Review invoice',
  send_onchain: 'Review send',
  open_channel: 'Review channel open',
  close_channel: 'Review channel close',
  connect_peer: 'Review connection',
  disconnect_peer: 'Review disconnect',
  new_address: 'Review new address',
};

interface KindReviewProps {
  operation: Operation;
  node: NodeSummary | null;
}

/**
 * The review of every kind but payments: what is approved, then one explicit confirmation — a
 * passkey step-up for sensitive kinds, a plain confirm for low-risk ones — or the reason it is blocked.
 */
export function KindReview({ operation, node }: KindReviewProps) {
  const kind = operation.request.kind;
  if (kind === 'pay_invoice') return null;
  return (
    <ReviewFrame
      operation={operation}
      title={REVIEW_TITLE[kind]}
      consent={<KindConsent operation={operation} node={node} />}
      confirmation={
        <ConfirmPanel operation={operation} node={node} secondary={(sending) => <DiscardLink operation={operation} sending={sending} />} />
      }
    />
  );
}
