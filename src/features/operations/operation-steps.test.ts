import { describe, expect, it } from 'vitest';
import type { Operation } from '../../api/types';
import { operation } from '../../test/operation-journal';
import { NOT_OBSERVED_YET, TIME_NOT_RECORDED, operationSteps } from './operation-steps';

/** Fixture-built operation with test overrides; the contract validators are exercised elsewhere. */
const asOperation = (value: object) => value as Operation;
const byId = (steps: ReturnType<typeof operationSteps>) => Object.fromEntries(steps.map((step) => [step.id, step]));

/** Every timestamp a step shows must be one of the operation's own recorded times. */
function recordedTimes(op: Operation): Set<string> {
  return new Set([op.created_at, op.updated_at, op.last_reconciled_at].filter((value): value is string => value !== null));
}

describe('operation timeline steps', () => {
  it('shows an unknown, consumed payment without inventing dispatch or authorization times', () => {
    const op = asOperation({
      ...operation('pay_invoice', 'unknown', 'reconciling'),
      authorization: { status: 'consumed', mode: 'every_operation', expires_at: null },
      updated_at: '2026-10-21T12:00:10Z',
      last_reconciled_at: '2026-10-21T12:00:30Z',
    });
    const steps = byId(operationSteps(op));

    expect(steps.created).toMatchObject({ status: 'done', at: op.created_at });
    expect(steps.authorization).toMatchObject({ status: 'done', at: null, missing: TIME_NOT_RECORDED });
    expect(steps.dispatch).toMatchObject({ status: 'done', at: null, missing: TIME_NOT_RECORDED });
    expect(steps.updated).toMatchObject({ status: 'attention', at: '2026-10-21T12:00:10Z', detail: 'Checking with node' });
    expect(steps.reconciled).toMatchObject({ status: 'done', at: '2026-10-21T12:00:30Z' });
    expect(steps.final).toMatchObject({ status: 'not_observed', at: null, missing: NOT_OBSERVED_YET });
  });

  it('marks dispatch and checks as not observed before they happen', () => {
    const op = asOperation(operation('pay_invoice'));
    const steps = byId(operationSteps(op));
    expect(steps.authorization).toMatchObject({ status: 'not_observed', detail: 'Authorization required', missing: NOT_OBSERVED_YET });
    expect(steps.dispatch).toMatchObject({ status: 'not_observed', at: null, missing: NOT_OBSERVED_YET });
    expect(steps.reconciled).toMatchObject({ status: 'not_observed', at: null });
  });

  it('omits authorization for a kind that does not need it', () => {
    const op = asOperation(operation('create_invoice', 'succeeded', 'completed', true));
    expect(operationSteps(op).map((step) => step.id)).toEqual(['created', 'dispatch', 'updated', 'reconciled', 'final']);
  });

  it('times the final outcome with the recorded update time only once it is final', () => {
    const op = asOperation({ ...operation('pay_invoice', 'succeeded', 'settled', true), updated_at: '2026-10-21T12:00:40Z' });
    expect(byId(operationSteps(op)).final).toMatchObject({ status: 'done', at: '2026-10-21T12:00:40Z' });
  });

  it.each([
    ['awaiting_confirmation', 'not_dispatched'],
    ['pending', 'submitted'],
    ['unknown', 'reconciling'],
    ['succeeded', 'settled'],
    ['failed', 'submitted'],
    ['expired', 'not_dispatched'],
  ] as const)('uses only recorded times in state %s', (state, stage) => {
    const op = asOperation({ ...operation('pay_invoice', state, stage), last_reconciled_at: null });
    const recorded = recordedTimes(op);
    for (const step of operationSteps(op)) {
      if (step.at !== null) expect(recorded.has(step.at)).toBe(true);
    }
  });
});
