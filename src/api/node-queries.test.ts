import { describe, expect, it } from 'vitest';
import { PAGE_LIMIT, RECENT_PAYMENTS_LIMIT } from '../config';
import { paymentsQueryOptions } from './node-queries';

describe('bounded list page size', () => {
  it('keys a compact page separately from the default page', () => {
    expect(paymentsQueryOptions('lnd-lab', {}, { pageSize: RECENT_PAYMENTS_LIMIT }).queryKey).toEqual([
      'node', 'lnd-lab', 'payments', { limit: '5' },
    ]);
    expect(paymentsQueryOptions('lnd-lab', {}).queryKey).toEqual([
      'node', 'lnd-lab', 'payments', { limit: String(PAGE_LIMIT) },
    ]);
  });

  it.each([0, -1, 1.5, NaN, Infinity, PAGE_LIMIT + 1])('rejects invalid page size %s', (pageSize) => {
    expect(() => paymentsQueryOptions('lnd-lab', {}, { pageSize })).toThrow(RangeError);
  });
});
