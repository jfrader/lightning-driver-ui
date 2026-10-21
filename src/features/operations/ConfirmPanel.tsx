import { Alert, Button, Flex } from '@jfrader/ui';
import type { NodeSummary, Operation } from '../../api/types';
import { isPast } from '../../lib/time';
import { useNow } from '../../lib/use-now';
import { PasskeyError } from '../auth/PasskeyError';
import { CAPABILITY_REASON } from '../nodes/labels';
import { CONFIRM_LABEL } from './labels';
import { RestartLink } from './RestartLink';
import { UnansweredConfirmationError } from './unanswered';
import { useConfirmOperation } from './use-confirm-operation';

interface ConfirmPanelProps {
  operation: Operation;
  /** The node's current registry entry; `null` when the server no longer configures it. */
  node: NodeSummary | null;
}

function blockReason(operation: Operation, node: NodeSummary | null, now: number): string | null {
  if (!node) return 'This node is not configured anymore.';
  const { review } = operation;
  const capability = node.capabilities[operation.request.kind];
  if (node.read_only) return CAPABILITY_REASON.read_only;
  if (isPast(review.expires_at, now)) return 'This review expired.';
  if (node.identity_revision !== review.node.identity_revision || node.network !== review.node.network) {
    return 'The node identity or network changed after this review.';
  }
  if (!capability.enabled) return CAPABILITY_REASON[capability.reason];
  return null;
}

/** Explicit confirmation of one awaiting review. Sensitive kinds require a passkey step-up. */
export function ConfirmPanel({ operation, node }: ConfirmPanelProps) {
  const now = useNow();
  const { confirm, isPending, error } = useConfirmOperation(operation);
  const blocked = blockReason(operation, node, now);

  if (blocked) {
    return (
      <Flex direction="column" gap="sm" align="start">
        <Alert tone="warning" title={blocked}>
          Nothing was sent.
        </Alert>
        {node && <RestartLink operation={operation} />}
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="sm" align="start">
      <Button tone="accent" size="lg" loading={isPending} onClick={confirm}>
        {CONFIRM_LABEL[operation.request.kind]}
      </Button>
      {error !== null && !(error instanceof UnansweredConfirmationError) && <PasskeyError error={error} />}
    </Flex>
  );
}
