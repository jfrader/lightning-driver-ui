import { describe, expect, it } from 'vitest';
import type { Channel } from '../../api/types';
import { fixture } from '../../test/fixtures';
import { channelLiquidity } from './liquidity';

const base = fixture('channels_page').items[0] as Channel;
const channel = (overrides: Partial<Channel>): Channel => ({ ...base, ...overrides });

describe('channel liquidity', () => {
  it('splits the fixture channel exactly, with no remainder', () => {
    expect(channelLiquidity(base)).toEqual({
      capacity: 1_000_000_000n,
      local: 500_000_123n,
      remote: 499_999_877n,
      remainder: 0n,
    });
  });

  it('keeps capacity in neither balance as its own remainder', () => {
    expect(channelLiquidity(channel({ local_msat: '300000000', remote_msat: '600000000' }))?.remainder).toBe(100_000_000n);
  });

  it('clamps the remainder at zero when the balances exceed capacity', () => {
    expect(channelLiquidity(channel({ local_msat: '600000000', remote_msat: '600000001' }))?.remainder).toBe(0n);
  });

  it('keeps i64-scale values exact', () => {
    const big = channelLiquidity(channel({ capacity_sat: '9223372036854775', local_msat: '9223372036854775000', remote_msat: '0' }));
    expect(big).toEqual({ capacity: 9_223_372_036_854_775_000n, local: 9_223_372_036_854_775_000n, remote: 0n, remainder: 0n });
  });

  it.each([
    ['local', { local_msat: null }],
    ['remote', { remote_msat: null }],
    ['capacity', { capacity_sat: null }],
  ])('has no split when %s is not reported', (_label, overrides) => {
    expect(channelLiquidity(channel(overrides))).toBeNull();
  });
});
