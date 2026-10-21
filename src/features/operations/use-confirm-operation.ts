import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ContractError } from '../../api/errors';
import { nodeKeys } from '../../api/node-queries';
import {
  confirmOperation,
  finishOperationAuthorization,
  startOperationAuthorization,
} from '../../api/operation-api';
import type { Operation } from '../../api/types';
import { throwIfAbandoned, useAttemptSignal } from '../../lib/use-attempt-signal';
import { requestPasskeyAssertion } from '../auth/passkey';
import { UnansweredConfirmationError, isUnansweredConfirmation } from './unanswered';

/**
 * Server step-up for a sensitive operation: a one-use grant bound to this operation and digest.
 * Every await checks `signal`, so a closed review never continues to the next step.
 */
async function authorize(operation: Operation, signal: AbortSignal): Promise<string> {
  const { id, node_id: nodeId } = operation;
  const digest = operation.review.digest;
  const start = await startOperationAuthorization(nodeId, id, digest, signal);
  throwIfAbandoned(signal);
  if (start.status === 'authorized') return checkedGrant(start.authorization, operation);
  const credential = await requestPasskeyAssertion(start.challenge.options, signal);
  throwIfAbandoned(signal);
  const grant = await finishOperationAuthorization(
    nodeId,
    id,
    { challenge_id: start.challenge.challenge_id, review_digest: digest, credential },
    signal,
  );
  return checkedGrant(grant, operation);
}

function checkedGrant(
  grant: { authorization_id: string; operation_id: string; node_id: string; review_digest: string },
  operation: Operation,
): string {
  const { id, node_id: nodeId, review } = operation;
  if (grant.operation_id !== id || grant.node_id !== nodeId || grant.review_digest !== review.digest) {
    throw new ContractError('authorize', 'authorization is for another operation');
  }
  return grant.authorization_id;
}

interface Attempt {
  reviewed: Operation;
  signal: AbortSignal;
}

/**
 * Confirms exactly the reviewed server operation it was given: node, operation ID and digest
 * all come from that record, never from form state or the current URL. Leaving the review
 * (navigation, node switch, session loss) abandons an attempt that has not reached confirm yet;
 * once confirm is sent, the outcome is only observed, never rolled back or repeated.
 */
export function useConfirmOperation(operation: Operation) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const startAttempt = useAttemptSignal();
  const inFlight = useRef(false);
  const { id: operationId, node_id: nodeId } = operation;

  const mutation = useMutation({
    mutationFn: async ({ reviewed, signal }: Attempt) => {
      const authorizationId = reviewed.review.sensitive ? await authorize(reviewed, signal) : null;
      throwIfAbandoned(signal);
      try {
        return await confirmOperation(reviewed.node_id, reviewed.id, {
          review_digest: reviewed.review.digest,
          authorization_id: authorizationId,
        });
      } catch (error) {
        if (isUnansweredConfirmation(error)) throw new UnansweredConfirmationError();
        throw error;
      }
    },
    onSuccess: (confirmed) => {
      queryClient.setQueryData(nodeKeys.operation(nodeId, operationId), confirmed);
      void queryClient.invalidateQueries({ queryKey: nodeKeys.summary(nodeId) });
    },
    onError: (error, { signal }) => {
      void queryClient.invalidateQueries({ queryKey: nodeKeys.operation(nodeId, operationId) });
      if (error instanceof UnansweredConfirmationError && !signal.aborted) {
        void navigate({
          to: '/nodes/$nodeId/operations/$operationId',
          params: { nodeId, operationId },
          search: { confirmation: 'unanswered' },
          replace: true,
        });
      }
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });

  const confirm = () => {
    if (inFlight.current) return;
    inFlight.current = true;
    mutation.mutate({ reviewed: operation, signal: startAttempt() });
  };

  return { confirm, isPending: mutation.isPending, error: mutation.error };
}
