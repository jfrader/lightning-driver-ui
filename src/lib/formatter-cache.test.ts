import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.restoreAllMocks());

describe('formatter reuse', () => {
  it('constructs once per locale/options, not per timestamp or tick', async () => {
    vi.resetModules();
    const dates = vi.spyOn(Intl, 'DateTimeFormat');
    const relative = vi.spyOn(Intl, 'RelativeTimeFormat');
    const { formatListTime, formatAge, formatAgeShort, formatClockTime, formatDetailTime, formatDateTime } = await import('./time');
    const now = Date.parse('2026-10-21T12:00:00Z');
    const today = '2026-10-21T11:00:00Z';
    const yesterday = '2026-10-20T11:00:00Z';
    for (let row = 0; row < 100; row += 1) {
      const tick = now + row * 15_000;
      expect(formatListTime(today, tick, 'en-us')).toBe('11:00');
      expect(formatListTime(yesterday, tick, ['en-US'])).toBe('Oct 20, 2026, 11:00');
      formatClockTime(today, 'en-US');
      formatDetailTime(today, 'en-US');
      formatDateTime(today, new Intl.Locale('en-US'));
      formatAge(today, tick, 'en-US');
      formatAgeShort(today, tick, 'en-US');
    }
    expect(dates).toHaveBeenCalledTimes(6);
    expect(relative).toHaveBeenCalledTimes(2);
    expect(formatListTime(today, now, 'de-DE')).toBe('11:00');
    expect(dates).toHaveBeenCalledTimes(8);
  });

  it('preserves exact strings/bigints and caches each actual precision', async () => {
    vi.resetModules();
    const numbers = vi.spyOn(Intl, 'NumberFormat');
    const { formatMsat, formatInteger } = await import('./money');
    for (let row = 0; row < 100; row += 1) {
      expect(formatMsat(9_007_199_254_740_993n, 'sat', 'en-us')).toBe('9,007,199,254,740.993 sat');
      expect(formatMsat(100_000_000_000n, 'btc', ['en-US'])).toBe('1.00000000 BTC');
      expect(formatInteger(9_007_199_254_740_993n, new Intl.Locale('en-US'))).toBe('9,007,199,254,740,993');
    }
    expect(numbers).toHaveBeenCalledTimes(3);
    expect(formatMsat(1_000n, 'sat', 'de-DE')).toBe('1 sat');
    expect(numbers).toHaveBeenCalledTimes(4);
  });

  it('bounds retained formatters when runtime locales/options vary', async () => {
    const { formatterCache } = await import('./formatter-cache');
    const create = vi.fn((locale: Intl.LocalesArgument, options: { precision: number }) => ({ locale, options }));
    const get = formatterCache(create);
    const first = get('en-US', { precision: 0 });
    expect(get('en-us', { precision: 0 })).toBe(first);
    for (let precision = 1; precision <= 64; precision += 1) get('en-US', { precision });
    expect(get('en-US', { precision: 0 })).not.toBe(first);
    expect(create).toHaveBeenCalledTimes(66);
  });
});
