import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { isSessionLoss } from '../../api/errors';
import { nodeKeys } from '../../api/node-queries';
import { confirmOperation, createOperation } from '../../api/operation-api';
import type { CreateOperationRequest, Operation } from '../../api/types';
import { throwIfAbandoned, useAttempt, type Attempt } from '../../lib/use-attempt';
import { isUnansweredConfirmation } from './unanswered';
import { useIntentKey } from './use-intent-key';

export interface SubmitResult {
  operation: Operation;
  /** Set when a low-risk confirm got no trustworthy answer. */
  confirmation: 'unanswered' | undefined;
  /** A definite error from the low-risk confirm; the review still exists. */
  confirmError: unknown;
}

interface Submission {
  request: CreateOperationRequest;
  attempt: Attempt;
}

/**
 * The one entry into the operation pipeline for every kind. It creates the immutable server
 * review; only low-risk kinds (server `review.sensitive === false`) are confirmed in the same
 * explicit action, and only while the form and its session are current. Sensitive kinds open the
 * review page and wait for a passkey confirmation. Late answers for an ended screen or session
 * neither write the cache nor navigate.
 */
export function useSubmitOperation(nodeId: string) {
  const keyFor = useIntentKey();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const startAttempt = useAttempt();

  const mutation = useMutation({
    mutationFn: async ({ request, attempt }: Submission): Promise<SubmitResult> => {
      const operation = await createOperation(nodeId, request, keyFor(request));
      if (operation.review.sensitive || operation.state !== 'awaiting_confirmation') {
        return { operation, confirmation: undefined, confirmError: null };
      }
      throwIfAbandoned(attempt);
      try {
        const confirmed = await confirmOperation(nodeId, operation.id, {
          review_digest: operation.review.digest,
          authorization_id: null,
        });
        return { operation: confirmed, confirmation: undefined, confirmError: null };
      } catch (error) {
        // A 401 is not an operation result: let it reach the shared session-loss handling.
        if (isSessionLoss(error)) throw error;
        if (isUnansweredConfirmation(error)) return { operation, confirmation: 'unanswered', confirmError: null };
        return { operation, confirmation: undefined, confirmError: error };
      }
    },
    onSuccess: ({ operation, confirmation, confirmError }, { attempt }) => {
      if (!attempt.isCurrent()) return;
      queryClient.setQueryData(nodeKeys.operation(nodeId, operation.id), operation);
      void queryClient.invalidateQueries({ queryKey: nodeKeys.summary(nodeId) });
      if (confirmError) return;
      void navigate({
        to: '/nodes/$nodeId/operations/$operationId',
        params: { nodeId, operationId: operation.id },
        search: { confirmation },
      });
    },
  });

  return {
    mutate: (request: CreateOperationRequest) => mutation.mutate({ request, attempt: startAttempt() }),
    isPending: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
}
