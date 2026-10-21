import { describe, expect, it } from 'vitest';
import {
  AmountError,
  formatMsat,
  formatMsatInput,
  msatToWireSat,
  parseAmountInput,
  parsePositiveIntegerInput,
  parseWireDecimal,
  wireToMsat,
  type DisplayUnit,
} from './money';

const EN = 'en-US';
const ABOVE_SAFE_MSAT = 9_007_199_254_740_993n;
const I64_MAX = 9_223_372_036_854_775_807n;

describe('wire amounts', () => {
  it('keeps values beyond Number.MAX_SAFE_INTEGER exact', () => {
    expect(wireToMsat('9007199254740993', 'msat')).toBe(ABOVE_SAFE_MSAT);
    expect(formatMsat(ABOVE_SAFE_MSAT, 'sat', EN)).toBe('9,007,199,254,740.993 sat');
    expect(formatMsat(I64_MAX, 'btc', EN)).toBe('92,233,720.36854775807 BTC');
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

describe('locale display', () => {
  it.each([
    ['en-US', '9,007,199,254,740.993 sat'],
    ['de-DE', '9.007.199.254.740,993 sat'],
    ['fr-FR', '9 007 199 254 740,993 sat'],
    ['ar-EG', '٩٬٠٠٧٬١٩٩٬٢٥٤٬٧٤٠٫٩٩٣ sat'],
    ['hi-IN-u-nu-deva', '९०,०७,१९,९२,५४,७४०.९९३ sat'],
  ])('formats exactly in %s, including its own numerals', (locale, expected) => {
    expect(formatMsat(ABOVE_SAFE_MSAT, 'sat', locale)).toBe(expected);
  });
});

describe('amount input values', () => {
  const units: DisplayUnit[] = ['sat', 'btc'];

  it.each([1n, 999n, 1_000n, 123_456_789n, 100_000_000_000n, ABOVE_SAFE_MSAT, I64_MAX])(
    'round-trips %s msat through the number input value in both units',
    (msat) => {
      for (const unit of units) {
        expect(parseAmountInput(formatMsatInput(msat, unit), unit, { allowMsat: true })).toEqual({ ok: true, msat });
      }
    },
  );

  it('keeps the input value locale independent', () => {
    expect(formatMsatInput(123_456_789n, 'btc')).toBe('0.00123456789');
    expect(formatMsatInput(123_456_789n, 'sat')).toBe('123456.789');
  });

  it('switches units without changing the amount', () => {
    const sats = parseAmountInput('150000', 'sat', { allowMsat: false });
    expect(sats).toEqual({ ok: true, msat: 150_000_000n });
    if (!sats.ok) return;
    expect(formatMsatInput(sats.msat, 'btc')).toBe('0.0015');
    expect(parseAmountInput('0.0015', 'btc', { allowMsat: false })).toEqual(sats);
  });

  it('parses plain decimals beyond the safe integer range exactly', () => {
    expect(parseAmountInput('9007199254740993', 'sat', { allowMsat: false })).toEqual({
      ok: true,
      msat: 9_007_199_254_740_993_000n,
    });
    expect(parseAmountInput('9007199254740.993', 'sat', { allowMsat: true })).toEqual({
      ok: true,
      msat: 9_007_199_254_740_993n,
    });
  });

  const MALFORMED = 'Use digits and a decimal point only, without spaces or commas.';

  it.each([
    ['1 2', MALFORMED],
    ['1,2', MALFORMED],
    ['1,234.5', MALFORMED],
    ['1.234,5', MALFORMED],
    ['1.2.3', MALFORMED],
    ['١٢٣', MALFORMED],
    ['1٫2', MALFORMED],
    ['1e3', MALFORMED],
    ['-5', MALFORMED],
    ['+5', MALFORMED],
    [' 5', MALFORMED],
    ['5 ', MALFORMED],
    ['.5', MALFORMED],
    ['5.', MALFORMED],
    ['.', MALFORMED],
    ['', 'Enter an amount.'],
    ['1.2345', 'Too many decimal places.'],
    ['0', 'Enter an amount greater than zero.'],
    ['9223372036854775.808', 'Amount is too large.'],
  ])('rejects %j instead of guessing', (value, error) => {
    expect(parseAmountInput(value, 'sat', { allowMsat: true })).toEqual({ ok: false, error });
  });

  it.each([
    ['1.5', 'sat'],
    ['0.000000015', 'btc'],
  ] as const)('rejects sub-satoshi %j %s where only whole sats are allowed', (value, unit) => {
    expect(parseAmountInput(value, unit, { allowMsat: false })).toEqual({ ok: false, error: 'Use whole satoshis.' });
  });

  it.each(['1.0', '1,000', '١', '-1', '1e2', ''])('rejects %j as a whole number', (value) => {
    expect(parsePositiveIntegerInput(value).ok).toBe(false);
  });
});
