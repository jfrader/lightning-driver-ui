import type { Operation, OperationStage, OperationState } from '../../api/types';
import { AUTHORIZATION_STATUS, OPERATION_STAGE } from './labels';

/** done: the record proves it; attention: proven but the outcome is unknown; not_observed: not proven yet. */
export type StepStatus = 'done' | 'attention' | 'not_observed';

export interface OperationStep {
  id: 'created' | 'authorization' | 'dispatch' | 'updated' | 'reconciled' | 'final';
  label: string;
  detail: string | null;
  status: StepStatus;
  /** A recorded timestamp from the operation, never a derived or interpolated one. */
  at: string | null;
  /** What to say when there is no time: a done step's time was not recorded; otherwise it was not observed. */
  missing: string;
}

/** Stages that prove the request left the server for the node. */
const DISPATCHED: ReadonlySet<OperationStage> = new Set([
  'submitted',
  'reconciling',
  'broadcast',
  'confirmed',
  'settled',
  'channel_active',
  'channel_closed',
  'completed',
]);
const FINAL: ReadonlySet<OperationState> = new Set(['succeeded', 'failed', 'expired']);
const AUTHORIZED: ReadonlySet<Operation['authorization']['status']> = new Set(['authorized', 'consumed']);

export const TIME_NOT_RECORDED = 'Time not recorded';
export const NOT_OBSERVED_YET = 'Not observed yet';

/**
 * Timeline steps built only from `created_at`, `updated_at`, `last_reconciled_at`, `state`, `stage`
 * and `authorization`. A step the record proves but does not timestamp keeps `at: null`; a step it
 * cannot prove yet is `not_observed`. No time is ever invented.
 */
export function operationSteps(operation: Operation): OperationStep[] {
  const authorizationNeeded = operation.authorization.status !== 'not_required';
  const final = FINAL.has(operation.state);
  const steps: OperationStep[] = [
    {
      id: 'created',
      label: 'Review created',
      detail: null,
      status: 'done',
      at: operation.created_at,
      missing: TIME_NOT_RECORDED,
    },
  ];
  if (authorizationNeeded) {
    steps.push({
      id: 'authorization',
      label: 'Authorization',
      detail: AUTHORIZATION_STATUS[operation.authorization.status],
      status: AUTHORIZED.has(operation.authorization.status) ? 'done' : 'not_observed',
      at: null,
      missing: AUTHORIZED.has(operation.authorization.status) ? TIME_NOT_RECORDED : NOT_OBSERVED_YET,
    });
  }
  const dispatched = DISPATCHED.has(operation.stage);
  steps.push(
    {
      id: 'dispatch',
      label: 'Sent to node',
      detail: null,
      status: dispatched ? 'done' : 'not_observed',
      at: null,
      missing: dispatched ? TIME_NOT_RECORDED : NOT_OBSERVED_YET,
    },
    {
      id: 'updated',
      label: 'Last state change',
      detail: OPERATION_STAGE[operation.stage],
      status: operation.state === 'unknown' ? 'attention' : 'done',
      at: operation.updated_at,
      missing: TIME_NOT_RECORDED,
    },
    {
      id: 'reconciled',
      label: 'Last checked with the node',
      detail: null,
      status: operation.last_reconciled_at ? 'done' : 'not_observed',
      at: operation.last_reconciled_at,
      missing: NOT_OBSERVED_YET,
    },
    {
      id: 'final',
      label: 'Final outcome',
      detail: final ? null : 'Outcome not final',
      status: final ? 'done' : 'not_observed',
      at: final ? operation.updated_at : null,
      missing: NOT_OBSERVED_YET,
    },
  );
  return steps;
}
