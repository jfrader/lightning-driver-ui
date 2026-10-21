import { CONFIRM_TIMEOUT_MS } from '../config';
import { apiRequest, expectNode, nodePath } from './client';
import { ContractError } from './errors';
import {
  AuthorizationStart,
  ConfirmOperationRequest,
  CreateOperationRequest,
  Operation,
  OperationAuthorization,
} from './generated/validators';
import type { AuthenticationCredential, CreateOperationRequest as CreateRequest, Operation as Op } from './types';

function expectOperation(path: string, nodeId: string, operationId: string | null, operation: Op): Op {
  expectNode(path, nodeId, operation.node_id, operation);
  expectNode(path, nodeId, operation.review.node.node_id, operation);
  if (operation.review.operation_id !== operation.id) throw new ContractError(path, 'review belongs to another operation');
  if (operationId !== null && operation.id !== operationId) throw new ContractError(path, 'response is another operation');
  return operation;
}

/** Creates an immutable review. The server never calls the node here. */
export async function createOperation(nodeId: string, request: CreateRequest, idempotencyKey: string) {
  const path = nodePath(nodeId, 'operations');
  const operation = await apiRequest({
    method: 'POST',
    path,
    body: request,
    bodyValidator: CreateOperationRequest,
    idempotencyKey,
    response: Operation,
  });
  if (operation.request.kind !== request.kind) throw new ContractError(path, 'operation kind differs from request');
  return expectOperation(path, nodeId, null, operation);
}

export async function getOperation(nodeId: string, operationId: string, signal?: AbortSignal) {
  const path = nodePath(nodeId, 'operations', operationId);
  const operation = await apiRequest({ method: 'GET', path, response: Operation, signal });
  return expectOperation(path, nodeId, operationId, operation);
}

/** Starts step-up for a reviewed operation. Never dispatches; abortable while the screen is open. */
export function startOperationAuthorization(
  nodeId: string,
  operationId: string,
  reviewDigest: string,
  signal?: AbortSignal,
) {
  return apiRequest({
    method: 'POST',
    path: nodePath(nodeId, 'operations', operationId, 'authorize'),
    body: { review_digest: reviewDigest },
    response: AuthorizationStart,
    signal,
  });
}

export function finishOperationAuthorization(
  nodeId: string,
  operationId: string,
  body: { challenge_id: string; review_digest: string; credential: AuthenticationCredential },
  signal?: AbortSignal,
) {
  return apiRequest({
    method: 'POST',
    path: nodePath(nodeId, 'operations', operationId, 'authorize', 'finish'),
    body,
    response: OperationAuthorization,
    signal,
  });
}

/** Claims the reviewed operation for dispatch. A lost response leaves the outcome unknown. */
export async function confirmOperation(
  nodeId: string,
  operationId: string,
  body: { review_digest: string; authorization_id: string | null },
) {
  const path = nodePath(nodeId, 'operations', operationId, 'confirm');
  const operation = await apiRequest({
    method: 'POST',
    path,
    body,
    bodyValidator: ConfirmOperationRequest,
    response: Operation,
    timeoutMs: CONFIRM_TIMEOUT_MS,
  });
  return expectOperation(path, nodeId, operationId, operation);
}
