import { describe, expect, it } from 'vitest';
import type { Transaction } from '../../api/types';
import { fixture } from '../../test/fixtures';
import { DIRECTION, blockLabel, confirmationsLabel } from './labels';

const base = fixture('transactions_page').items[0] as Transaction;
const tx = (overrides: Partial<Transaction>): Transaction => ({ ...base, ...overrides });

describe('transaction words', () => {
  it.each([
    [null, null],
    ['0', 'Unconfirmed'],
    ['1', '1 confirmation'],
    ['6', '6 confirmations'],
    ['1000000', '1,000,000 confirmations'],
  ])('reads %s confirmations as %s', (value, label) => {
    expect(confirmationsLabel(value)?.label ?? null).toBe(label);
  });

  it('never calls a transaction final, safe, settled or completed', () => {
    const words = [
      ...Object.values(DIRECTION).map((state) => state.label),
      ...['0', '1', '6', '100'].map((value) => confirmationsLabel(value)?.label),
    ].join(' ');
    expect(words).not.toMatch(/final|safe|settled|completed|pending/i);
  });

  it('says an unconfirmed transaction is not in a block, and otherwise shows the height or nothing', () => {
    expect(blockLabel(tx({ block_height: null, confirmations: '0' }))).toBe('Not in a block');
    expect(blockLabel(tx({ block_height: '812345', confirmations: '3' }))).toBe('812,345');
    expect(blockLabel(tx({ block_height: null, confirmations: null }))).toBeNull();
    expect(blockLabel(tx({ block_height: null, confirmations: '2' }))).toBeNull();
  });

  it('marks only an unknown direction as needing a look', () => {
    expect(DIRECTION.unknown.tone).toBe('warning');
    expect([DIRECTION.incoming, DIRECTION.outgoing, DIRECTION.self].every((state) => state.tone === 'quiet')).toBe(true);
  });
});
