import { describe, expect, it } from 'vitest';
import type { Operation } from '../../api/types';
import { reconciliationSentence } from './operation-sentence';

type Reconciliation = NonNullable<Operation['reconciliation']>;

function reconciliation(last_outcome: Reconciliation['last_outcome'], exhausted = false): Reconciliation {
  return { attempts: 1, last_attempt_at: null, next_attempt_at: null, last_outcome, exhausted };
}

describe('reconciliation sentence', () => {
  it.each<{ outcome: Reconciliation['last_outcome']; sentence: string | null }>([
    { outcome: 'withheld', sentence: 'The node could not be reached.' },
    { outcome: 'not_found', sentence: 'The node reported no result yet.' },
    { outcome: 'pruned', sentence: 'The node reported no result yet.' },
    { outcome: 'invalid', sentence: 'The node returned an unusable answer.' },
    { outcome: 'conflict', sentence: 'The node returned an unusable answer.' },
    { outcome: 'in_flight', sentence: null },
    { outcome: 'positive', sentence: null },
    { outcome: 'rejected', sentence: null },
    { outcome: 'paid_elsewhere', sentence: null },
    { outcome: null, sentence: null },
  ])('maps $outcome to its literal line', ({ outcome, sentence }) => {
    expect(reconciliationSentence({ state: 'unknown', reconciliation: reconciliation(outcome) })).toBe(sentence);
  });

  it.each<Reconciliation['last_outcome']>(['withheld', 'not_found', 'pruned', 'invalid', 'conflict', 'in_flight', 'positive', 'rejected', 'paid_elsewhere', null])(
    'exhaustion overrides outcome %s', (outcome) => {
      expect(reconciliationSentence({ state: 'unknown', reconciliation: reconciliation(outcome, true) }))
        .toBe('No further automatic checks.');
    },
  );

  it.each<Operation['state']>(['pending', 'unknown', 'dispatching'])('shows reconciliation for %s', (state) => {
    expect(reconciliationSentence({ state, reconciliation: reconciliation('withheld') })).toBe('The node could not be reached.');
  });

  it('adds nothing without reconciliation', () => {
    expect(reconciliationSentence({ state: 'unknown' })).toBeNull();
    expect(reconciliationSentence({ state: 'unknown', reconciliation: null })).toBeNull();
  });

  it.each<Operation['state']>(['succeeded', 'failed', 'expired', 'awaiting_confirmation'])(
    'ignores reconciliation for %s', (state) => {
      expect(reconciliationSentence({ state, reconciliation: reconciliation('withheld') })).toBeNull();
      expect(reconciliationSentence({ state, reconciliation: reconciliation('invalid', true) })).toBeNull();
    },
  );
});
