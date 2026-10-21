import { describe, expect, it } from 'vitest';
import { complementaryShares, formatRatio, formatShare } from './ratio';

const EN = 'en-US';

const shareLabels = (first: bigint, second: bigint) => {
  const shares = complementaryShares(first, second);
  return shares && shares.map((tenths) => formatShare(tenths, EN));
};

describe('composition shares', () => {
  it.each([
    [995n, 5n, ['99.5%', '0.5%']],
    [1n, 2n, ['33.3%', '66.7%']],
    [2n, 1n, ['66.7%', '33.3%']],
    [1n, 1n, ['50.0%', '50.0%']],
    [1n, 0n, ['100.0%', '0.0%']],
    [0n, 1n, ['0.0%', '100.0%']],
    [9995n, 5n, ['99.9%', '0.1%']],
    [2_000_000_000n, 10_000_000n, ['99.5%', '0.5%']],
    [500_000_123n, 499_999_877n, ['50.0%', '50.0%']],
  ])('splits %s : %s into shares that sum to 100.0%%', (first, second, expected) => {
    expect(shareLabels(first, second)).toEqual(expected);
    const shares = complementaryShares(first, second);
    expect(shares && shares[0] + shares[1]).toBe(1000n);
  });

  it('keeps i64-scale parts exact', () => {
    expect(shareLabels(9_223_372_036_854_775_807n, 1n)).toEqual(['100.0%', '0.0%']);
  });

  it('has no shares for an empty total', () => {
    expect(complementaryShares(0n, 0n)).toBeNull();
  });
});

describe('fee ratio', () => {
  it.each([
    [1_000n, 2_500_000n, '0.04%'],
    [123n, 2_500_000n, '0.0049%'],
    [100_000n, 1_000_000n, '10%'],
    [1n, 3n, '33%'],
    [0n, 2_500_000n, '0%'],
  ])('%s of %s reads %s', (fee, amount, expected) => {
    expect(formatRatio(fee, amount, EN)).toBe(expected);
  });

  it('has no ratio for a zero amount', () => {
    expect(formatRatio(1n, 0n, EN)).toBeNull();
  });
});
