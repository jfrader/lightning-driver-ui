import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ContractError } from '../../api/errors';
import { nodeKeys } from '../../api/node-queries';
import {
  confirmOperation,
  finishNostrAuthorization,
  finishOperationAuthorization,
  startNostrAuthorization,
  startOperationAuthorization,
} from '../../api/operation-api';
import type {
  AuthMethod,
  AuthenticationChallenge,
  NostrChallenge,
  Operation,
  OperationAuthorization,
} from '../../api/types';
import { throwIfAbandoned, useAttempt, type Attempt } from '../../lib/use-attempt';
import { signNostrEvent } from '../auth/nostr';
import { requestPasskeyAssertion } from '../auth/passkey';
import { sessionQueryOptions } from '../auth/queries';
import { invalidateAffectedReads } from './affected-reads';
import { markConfirmAnswered, markConfirmSent } from './confirming';
import { UnansweredConfirmationError, isUnansweredConfirmation } from './unanswered';

type Grant = OperationAuthorization;

/** How a session of one sign-in method answers the operation challenge with a fresh proof. */
interface StepUp<Challenge> {
  start: (nodeId: string, operationId: string, digest: string, signal: AbortSignal) => Promise<
    { status: 'authorized'; authorization: Grant } | { status: 'challenge_required'; challenge: Challenge }
  >;
  prove: (operation: Operation, challenge: Challenge, attempt: Attempt) => Promise<Grant>;
}

const passkeyStepUp: StepUp<AuthenticationChallenge> = {
  start: startOperationAuthorization,
  prove: async ({ id, node_id: nodeId, review }, challenge, attempt) => {
    const credential = await requestPasskeyAssertion(challenge.options, attempt.signal);
    throwIfAbandoned(attempt);
    return finishOperationAuthorization(
      nodeId,
      id,
      { challenge_id: challenge.challenge_id, review_digest: review.digest, credential },
      attempt.signal,
    );
  },
};

const nostrStepUp: StepUp<NostrChallenge> = {
  start: startNostrAuthorization,
  prove: async ({ id, node_id: nodeId, review }, challenge, attempt) => {
    // A closed review stops after the signer answers, before sending the signed event.
    const event = await signNostrEvent(challenge.event);
    throwIfAbandoned(attempt);
    return finishNostrAuthorization(
      nodeId,
      id,
      { challenge_id: challenge.challenge_id, review_digest: review.digest, event },
      attempt.signal,
    );
  },
};

/**
 * Server step-up for a sensitive operation: a one-use grant bound to this operation and digest.
 * Every await checks the attempt, so a closed review never continues to the next step.
 */
async function authorize<Challenge>(operation: Operation, attempt: Attempt, stepUp: StepUp<Challenge>): Promise<string> {
  const start = await stepUp.start(operation.node_id, operation.id, operation.review.digest, attempt.signal);
  throwIfAbandoned(attempt);
  if (start.status === 'authorized') return checkedGrant(start.authorization, operation);
  const grant = await stepUp.prove(operation, start.challenge, attempt);
  return checkedGrant(grant, operation);
}

/** A passkey session proves with WebAuthn, a Nostr session with a signature from its key. */
const AUTHORIZE: Record<AuthMethod, (operation: Operation, attempt: Attempt) => Promise<string>> = {
  passkey: (operation, attempt) => authorize(operation, attempt, passkeyStepUp),
  nostr: (operation, attempt) => authorize(operation, attempt, nostrStepUp),
};

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

interface ConfirmAttempt {
  reviewed: Operation;
  attempt: Attempt;
}

/**
 * Confirms exactly the reviewed server operation it was given: node, operation ID and digest
 * all come from that record, never from form state or the current URL. Leaving the review
 * (navigation, node switch, session loss) abandons an attempt that has not reached confirm yet.
 * Once confirm is sent it is not aborted; a late answer for a screen or session that has ended
 * is ignored, and the journal shows the outcome on the next read.
 */
export function useConfirmOperation(operation: Operation) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const startAttempt = useAttempt();
  const inFlight = useRef(false);
  const { id: operationId, node_id: nodeId } = operation;

  const mutation = useMutation({
    mutationFn: async ({ reviewed, attempt }: ConfirmAttempt) => {
      let authorizationId: string | null = null;
      if (reviewed.review.sensitive) {
        const session = await queryClient.ensureQueryData(sessionQueryOptions);
        throwIfAbandoned(attempt);
        authorizationId = await AUTHORIZE[session.auth_method](reviewed, attempt);
      }
      throwIfAbandoned(attempt);
      markConfirmSent(queryClient, reviewed.id);
      try {
        return await confirmOperation(reviewed.node_id, reviewed.id, {
          review_digest: reviewed.review.digest,
          authorization_id: authorizationId,
        });
      } catch (error) {
        if (isUnansweredConfirmation(error)) throw new UnansweredConfirmationError();
        throw error;
      } finally {
        markConfirmAnswered(queryClient, reviewed.id);
      }
    },
    onSuccess: (confirmed, { attempt }) => {
      if (!attempt.isCurrent()) {
        void invalidateAffectedReads(queryClient, confirmed);
        return;
      }
      queryClient.setQueryData(nodeKeys.operation(nodeId, operationId), confirmed);
    },
    onError: (error, { attempt }) => {
      if (!attempt.isCurrent()) return;
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
    onSettled: (_data, error) => {
      if (error) inFlight.current = false;
    },
  });

  const confirm = () => {
    if (inFlight.current) return;
    inFlight.current = true;
    mutation.mutate({ reviewed: operation, attempt: startAttempt() });
  };

  return { confirm, isPending: mutation.isPending, error: mutation.error };
}
