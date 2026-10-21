import type { ReactNode } from 'react';
import { Alert, Button, Flex, styled } from '@jfrader/ui';
import type { NodeSummary, Operation, OperationKind } from '../../api/types';
import { TABLE_MEDIA } from '../../config';
import { useNow } from '../../lib/use-now';
import { PasskeyError } from '../auth/PasskeyError';
import { confirmBlockReason } from './confirm-block';
import { CONFIRM_LABEL } from './labels';
import { FormLink } from './review/kind-links';

/** The destructive kinds' primary action is danger-toned; there is no accent on those reviews. */
const DESTRUCTIVE: ReadonlySet<OperationKind> = new Set(['close_channel', 'disconnect_peer']);
import { UnansweredConfirmationError } from './unanswered';
import { useConfirmOperation } from './use-confirm-operation';

const Actions = styled.div(({ theme }) => ({
  display: 'grid',
  gap: theme.space[2],
  [TABLE_MEDIA]: { display: 'flex', alignItems: 'center', gap: theme.space[3] },
}));

interface ConfirmPanelProps {
  operation: Operation;
  /** The node's current registry entry; `null` when the server no longer configures it. */
  node: NodeSummary | null;
  /** A secondary action beside the primary one (e.g. Discard review); disabled once sending. */
  secondary?: (sending: boolean) => ReactNode;
}

/**
 * Explicit confirmation of one awaiting review. Sensitive kinds require a passkey step-up. The
 * primary button is an ordinary focusable button: never autofocused, no shortcut, no hold gesture.
 */
export function ConfirmPanel({ operation, node, secondary }: ConfirmPanelProps) {
  const now = useNow();
  const { confirm, isPending, error } = useConfirmOperation(operation);
  const blocked = confirmBlockReason(operation, node, now);

  if (blocked) {
    return (
      <Flex direction="column" gap="sm" align="start">
        <Alert tone="warning" title={blocked}>
          Nothing was sent.
        </Alert>
        {node && <FormLink operation={operation} label="Start a new review" />}
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="sm">
      <Actions>
        <Button tone={DESTRUCTIVE.has(operation.request.kind) ? 'danger' : 'accent'} variant="solid" size="lg" loading={isPending} onClick={confirm}>
          {CONFIRM_LABEL[operation.request.kind]}
        </Button>
        {secondary?.(isPending)}
      </Actions>
      {error !== null && !(error instanceof UnansweredConfirmationError) && <PasskeyError error={error} />}
    </Flex>
  );
}
