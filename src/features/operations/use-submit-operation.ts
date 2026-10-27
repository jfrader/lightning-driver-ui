import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { errorCode } from '../../api/errors';
import { nodeKeys } from '../../api/node-queries';
import { createOperation } from '../../api/operation-api';
import type { CreateOperationRequest } from '../../api/types';
import { useAttempt, type Attempt } from '../../lib/use-attempt';
import { useIntentKey } from './use-intent-key';
import { useOperationSheet } from './sheet-context';
import { NODE_OBSERVED_KINDS } from './labels';
import { useConfirmOperation } from './use-confirm-operation';
import { UnansweredConfirmationError } from './unanswered';

interface Submission {
  request: CreateOperationRequest;
  attempt: Attempt;
}

/**
 * The one entry into the operation pipeline for every form: it creates the immutable server review
 * (the server never calls the node here). Local results confirm immediately; observed operations
 * open their review for explicit confirmation. A review created for a screen or session that
 * has ended neither writes the cache nor navigates.
 */
export function useSubmitOperation(nodeId: string) {
  const sheet = useOperationSheet();
  const { keyFor, forget } = useIntentKey();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const startAttempt = useAttempt();
  const confirmation = useConfirmOperation();

  const mutation = useMutation({
    mutationFn: ({ request }: Submission) => createOperation(nodeId, request, keyFor(request)),
    onSuccess: async (operation, { attempt }) => {
      if (!attempt.isCurrent()) return;
      queryClient.setQueryData(nodeKeys.operation(nodeId, operation.id), operation);
      void queryClient.invalidateQueries({ queryKey: nodeKeys.detail(nodeId, 'operations') });
      let unanswered = false;
      if (!NODE_OBSERVED_KINDS[operation.request.kind] && operation.state === 'awaiting_confirmation') {
        try {
          await confirmation.confirmCreated(operation, attempt);
        } catch (error) {
          unanswered = error instanceof UnansweredConfirmationError;
        }
      }
      if (!attempt.isCurrent()) return;
      if (sheet) sheet.onCreated(operation, unanswered);
      else void navigate({ to: '/nodes/$nodeId/operations/$operationId', params: { nodeId, operationId: operation.id }, search: { confirmation: unanswered ? 'unanswered' : undefined } });
    },
    onError: (error) => {
      if (errorCode(error) === 'idempotency_conflict') forget();
    },
  });

  return {
    mutate: (request: CreateOperationRequest) => mutation.mutate({ request, attempt: startAttempt() }),
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
