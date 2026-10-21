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
import { requestPasskeyAssertion } from '../auth/passkey';
import { UnansweredConfirmationError, isUnansweredConfirmation } from './unanswered';

/** Server step-up for a sensitive operation: a one-use grant bound to this operation and digest. */
async function authorize(operation: Operation): Promise<string> {
  const { id, node_id: nodeId } = operation;
  const digest = operation.review.digest;
  const start = await startOperationAuthorization(nodeId, id, digest);
  const grant =
    start.status === 'authorized'
      ? start.authorization
      : await finishOperationAuthorization(nodeId, id, {
          challenge_id: start.challenge.challenge_id,
          review_digest: digest,
          credential: await requestPasskeyAssertion(start.challenge.options),
        });
  if (grant.operation_id !== id || grant.node_id !== nodeId || grant.review_digest !== digest) {
    throw new ContractError('authorize', 'authorization is for another operation');
  }
  return grant.authorization_id;
}

/**
 * Confirms exactly the reviewed server operation it was given: node, operation ID and digest
 * all come from that record, never from form state or the current URL.
 */
export function useConfirmOperation(operation: Operation) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const inFlight = useRef(false);
  const { id: operationId, node_id: nodeId } = operation;

  const mutation = useMutation({
    mutationFn: async (reviewed: Operation) => {
      const authorizationId = reviewed.review.sensitive ? await authorize(reviewed) : null;
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
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: nodeKeys.operation(nodeId, operationId) });
      if (error instanceof UnansweredConfirmationError) {
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
    mutation.mutate(operation);
  };

  return { confirm, isPending: mutation.isPending, error: mutation.error };
}
