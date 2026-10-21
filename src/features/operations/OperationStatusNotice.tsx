import { Alert } from '@jfrader/ui';
import type { Operation } from '../../api/types';

interface OperationStatusNoticeProps {
  operation: Operation;
  unanswered: boolean;
}

/** What the operator may rely on right now. Unknown is never shown as a failure. */
export function OperationStatusNotice({ operation, unanswered }: OperationStatusNoticeProps) {
  const { state, error } = operation;
  if (unanswered && state === 'awaiting_confirmation') {
    return (
      <Alert tone="warning" title="No answer to the confirmation">
        Checking the status. Do not repeat this action until the status changes.
      </Alert>
    );
  }
  if (state === 'unknown') {
    return (
      <Alert tone="warning" title="Outcome unknown">
        The node may have acted. This page keeps checking. Do not repeat this action until it resolves.
      </Alert>
    );
  }
  if (state === 'dispatching' || state === 'pending') {
    return <Alert tone="info" title="Pending">This page updates automatically.</Alert>;
  }
  if (state === 'failed') {
    return <Alert tone="danger" title="Failed">{error?.message ?? 'The node reported a failure.'}</Alert>;
  }
  if (state === 'expired') {
    return <Alert tone="info" title="Review expired">Nothing was sent.</Alert>;
  }
  if (state === 'succeeded' && operation.stage === 'broadcast') {
    return <Alert tone="info" title="Broadcast">Not confirmed on chain yet.</Alert>;
  }
  return null;
}
