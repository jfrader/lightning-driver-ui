import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { errorCode } from '../../api/errors';
import { nodeKeys } from '../../api/node-queries';
import { createOperation } from '../../api/operation-api';
import type { CreateOperationRequest } from '../../api/types';
import { useAttempt, type Attempt } from '../../lib/use-attempt';
import { useIntentKey } from './use-intent-key';

interface Submission {
  request: CreateOperationRequest;
  attempt: Attempt;
}

/**
 * The one entry into the operation pipeline for every form: it creates the immutable server review
 * (the server never calls the node here) and opens it. Nothing is confirmed from a form; every kind
 * is confirmed on its review with one explicit action. A review created for a screen or session that
 * has ended neither writes the cache nor navigates.
 */
export function useSubmitOperation(nodeId: string) {
  const { keyFor, forget } = useIntentKey();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const startAttempt = useAttempt();

  const mutation = useMutation({
    mutationFn: ({ request }: Submission) => createOperation(nodeId, request, keyFor(request)),
    onSuccess: (operation, { attempt }) => {
      if (!attempt.isCurrent()) return;
      queryClient.setQueryData(nodeKeys.operation(nodeId, operation.id), operation);
      void navigate({ to: '/nodes/$nodeId/operations/$operationId', params: { nodeId, operationId: operation.id } });
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
