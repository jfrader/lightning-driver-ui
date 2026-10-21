import { describe, expect, it } from 'vitest';
import {
  AmountError,
  formatMsat,
  formatMsatInput,
  msatToWireSat,
  parseAmountInput,
  parseWireDecimal,
  wireToMsat,
} from './money';

const EN = 'en-US';
const DE = 'de-DE';

describe('wire amounts', () => {
  it('keeps values beyond Number.MAX_SAFE_INTEGER exact', () => {
    expect(wireToMsat('9007199254740993', 'msat')).toBe(9_007_199_254_740_993n);
    expect(formatMsat(9_007_199_254_740_993n, 'sat', EN)).toBe('9,007,199,254,740.993 sat');
    expect(formatMsat(9_223_372_036_854_775_807n, 'btc', EN)).toBe('92,233,720.36854775807 BTC');
  });

  it('shows sub-satoshi precision instead of rounding', () => {
    expect(formatMsat(500_000_123n, 'sat', EN)).toBe('500,000.123 sat');
    expect(formatMsat(1n, 'btc', EN)).toBe('0.00000000001 BTC');
    expect(formatMsat(100_000_000_000n, 'btc', EN)).toBe('1.00000000 BTC');
  });

  it('converts sats to millisatoshis exactly', () => {
    expect(wireToMsat('2100000000000000', 'sat')).toBe(2_100_000_000_000_000_000n);
  });

  it.each(['01', '-1', '1.5', '1e3', ' 1', '', '9223372036854775808', '0x10'])('rejects %j', (value) => {
    expect(() => parseWireDecimal(value)).toThrow(AmountError);
  });

  it('refuses to turn sub-satoshi amounts into a sat wire value', () => {
    expect(msatToWireSat(5_000n)).toBe('5');
    expect(() => msatToWireSat(5_001n)).toThrow(AmountError);
  });
});

describe('typed amounts', () => {
  it('parses with the locale separators', () => {
    expect(parseAmountInput('1,234.567', 'sat', { allowMsat: true, locale: EN })).toEqual({ ok: true, msat: 1_234_567n });
    expect(parseAmountInput('1.234,567', 'sat', { allowMsat: true, locale: DE })).toEqual({ ok: true, msat: 1_234_567n });
    expect(parseAmountInput('0.00000001', 'btc', { allowMsat: false, locale: EN })).toEqual({ ok: true, msat: 1_000n });
  });

  it('parses amounts beyond the safe integer range exactly', () => {
    expect(parseAmountInput('9007199254740993', 'sat', { allowMsat: false, locale: EN })).toEqual({
      ok: true,
      msat: 9_007_199_254_740_993_000n,
    });
  });

  it('rejects sub-satoshi input where only whole sats are allowed', () => {
    expect(parseAmountInput('1.5', 'sat', { allowMsat: false, locale: EN })).toEqual({
      ok: false,
      error: 'Use whole satoshis.',
    });
  });

  it.each([
    ['abc', 'Enter an amount using digits.'],
    ['1.2345', 'Too many decimal places.'],
    ['0', 'Enter an amount greater than zero.'],
    ['9223372036854775.808', 'Amount is too large.'],
    ['-5', 'Enter an amount using digits.'],
  ])('reports %j', (text, error) => {
    expect(parseAmountInput(text, 'sat', { allowMsat: true, locale: EN })).toEqual({ ok: false, error });
  });

  it('round-trips through editable text when the unit changes', () => {
    expect(formatMsatInput(123_456_789n, 'btc', EN)).toBe('0.00123456789');
    expect(formatMsatInput(123_456_789n, 'sat', DE)).toBe('123456,789');
  });
});
