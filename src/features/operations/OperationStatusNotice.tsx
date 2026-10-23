import { Alert, Flex, type AlertTone } from '@jfrader/ui';
import type { Operation, OperationState } from '../../api/types';
import { LastChecked } from './LastChecked';
import { operationSentence, reconciliationSentence } from './operation-sentence';

interface OperationStatusNoticeProps {
  operation: Operation;
  unanswered: boolean;
}

const TONE: Record<OperationState, AlertTone> = {
  awaiting_confirmation: 'info',
  dispatching: 'info',
  pending: 'info',
  unknown: 'warning',
  succeeded: 'info',
  failed: 'danger',
  expired: 'info',
};

/**
 * What the operator may rely on right now, with when the server last checked with the node. The
 * state word lives in the page pill; this says what is known and what not to do. Unknown is never
 * shown as a failure, and nothing here retries.
 */
export function OperationStatusNotice({ operation, unanswered }: OperationStatusNoticeProps) {
  if (unanswered && operation.state === 'awaiting_confirmation') {
    return (
      <Alert tone="warning" title="No answer to the confirmation">
        Checking the status. Do not repeat this action until the status changes.
      </Alert>
    );
  }
  const sentence = operationSentence(operation);
  const reconciliation = reconciliationSentence(operation);
  if (sentence === null) return null;
  return (
    <Alert tone={TONE[operation.state]}>
      <Flex direction="column" gap="xs">
        <span>{sentence}</span>
        {reconciliation !== null && <span>{reconciliation}</span>}
        <LastChecked at={operation.last_reconciled_at} />
      </Flex>
    </Alert>
  );
}
