import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { nodeKeys } from '../../api/node-queries';
import { confirmOperation, createOperation } from '../../api/operation-api';
import type { CreateOperationRequest, Operation } from '../../api/types';
import { throwIfAbandoned, useAttemptSignal } from '../../lib/use-attempt-signal';
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
  signal: AbortSignal;
}

/**
 * The one entry into the operation pipeline for every kind. It creates the immutable server
 * review; only low-risk kinds (server `review.sensitive === false`) are confirmed in the same
 * explicit action, and only while the form is still open. Sensitive kinds open the review page
 * and wait for a passkey confirmation.
 */
export function useSubmitOperation(nodeId: string) {
  const keyFor = useIntentKey();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const startAttempt = useAttemptSignal();

  const mutation = useMutation({
    mutationFn: async ({ request, signal }: Submission): Promise<SubmitResult> => {
      const operation = await createOperation(nodeId, request, keyFor(request));
      if (operation.review.sensitive || operation.state !== 'awaiting_confirmation') {
        return { operation, confirmation: undefined, confirmError: null };
      }
      throwIfAbandoned(signal);
      try {
        const confirmed = await confirmOperation(nodeId, operation.id, {
          review_digest: operation.review.digest,
          authorization_id: null,
        });
        return { operation: confirmed, confirmation: undefined, confirmError: null };
      } catch (error) {
        if (isUnansweredConfirmation(error)) return { operation, confirmation: 'unanswered', confirmError: null };
        return { operation, confirmation: undefined, confirmError: error };
      }
    },
    onSuccess: ({ operation, confirmation, confirmError }, { signal }) => {
      queryClient.setQueryData(nodeKeys.operation(nodeId, operation.id), operation);
      void queryClient.invalidateQueries({ queryKey: nodeKeys.summary(nodeId) });
      if (confirmError || signal.aborted) return;
      void navigate({
        to: '/nodes/$nodeId/operations/$operationId',
        params: { nodeId, operationId: operation.id },
        search: { confirmation },
      });
    },
  });

  return {
    mutate: (request: CreateOperationRequest) => mutation.mutate({ request, signal: startAttempt() }),
    isPending: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
}
