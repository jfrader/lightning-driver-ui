// Exact amounts: wire strings become bigint millisatoshis. No floating point anywhere.
import { DISPLAY_LOCALE } from '../config';

export type DisplayUnit = 'sat' | 'btc';
export type WireUnit = 'sat' | 'msat';

export const UNIT_LABEL: Record<DisplayUnit, string> = { sat: 'sat', btc: 'BTC' };

const I64_MAX = 9_223_372_036_854_775_807n;
const MSAT_PER_SAT = 1000n;
const CANONICAL_DECIMAL = /^(?:0|[1-9][0-9]*)$/;

/** Fraction digits of one millisatoshi in each display unit. */
const UNIT_SCALE: Record<DisplayUnit, number> = { sat: 3, btc: 11 };
/** Fraction digits always shown, so BTC reads as satoshi precision. */
const UNIT_MIN_FRACTION: Record<DisplayUnit, number> = { sat: 0, btc: 8 };

export class AmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AmountError';
  }
}

/** Parses a canonical non-negative i64 decimal string from the API. */
export function parseWireDecimal(value: string): bigint {
  if (!CANONICAL_DECIMAL.test(value)) throw new AmountError(`"${value}" is not a canonical amount.`);
  const parsed = BigInt(value);
  if (parsed > I64_MAX) throw new AmountError(`"${value}" is out of range.`);
  return parsed;
}

export function wireToMsat(value: string, unit: WireUnit): bigint {
  const parsed = parseWireDecimal(value);
  return unit === 'sat' ? parsed * MSAT_PER_SAT : parsed;
}

export function msatToWireMsat(msat: bigint): string {
  return msat.toString();
}

export function msatToWireSat(msat: bigint): string {
  if (msat % MSAT_PER_SAT !== 0n) throw new AmountError('Amount is not a whole number of satoshis.');
  return (msat / MSAT_PER_SAT).toString();
}

function isDecimalLiteral(value: string): value is Intl.StringNumericLiteral {
  return /^[0-9]+(?:\.[0-9]+)?$/.test(value);
}

/** Exact decimal string of `msat` in the unit; Intl formats such strings without float rounding. */
function toDecimal(msat: bigint, unit: DisplayUnit): Intl.StringNumericLiteral {
  const scale = UNIT_SCALE[unit];
  const divisor = 10n ** BigInt(scale);
  const whole = msat / divisor;
  const fraction = (msat % divisor).toString().padStart(scale, '0').replace(/0+$/, '');
  const decimal = fraction ? `${whole}.${fraction}` : `${whole}`;
  if (!isDecimalLiteral(decimal)) throw new AmountError(`Cannot format ${decimal}.`);
  return decimal;
}

function fractionLength(decimal: string): number {
  const dot = decimal.indexOf('.');
  return dot === -1 ? 0 : decimal.length - dot - 1;
}

/** Formats exact millisatoshis in the chosen unit with locale separators, e.g. "1,234.567 sat". */
export function formatMsat(msat: bigint, unit: DisplayUnit, locale: Intl.LocalesArgument = DISPLAY_LOCALE): string {
  const decimal = toDecimal(msat, unit);
  const digits = Math.max(UNIT_MIN_FRACTION[unit], fractionLength(decimal));
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(decimal);
  return `${number} ${UNIT_LABEL[unit]}`;
}

/**
 * Exact amount as the canonical value of an `<input type="number">` ("0.0015"). The browser shows
 * it with the field's locale; the value itself is never localized.
 */
export function formatMsatInput(msat: bigint, unit: DisplayUnit): string {
  return toDecimal(msat, unit);
}

export function formatInteger(value: bigint, locale: Intl.LocalesArgument = DISPLAY_LOCALE): string {
  return new Intl.NumberFormat(locale).format(value);
}

export type AmountInputResult = { ok: true; msat: bigint } | { ok: false; error: string };

interface AmountInputOptions {
  /** Accept millisatoshi precision; otherwise only whole satoshis. */
  allowMsat: boolean;
}

/**
 * HTML "valid floating-point number" without sign or exponent. `<input type="number">` turns the
 * operator's localized entry into this canonical string, or into "" when it cannot read it.
 */
const CANONICAL_INPUT = /^(?:([0-9]+)(?:\.([0-9]+))?|\.([0-9]+))$/;

/**
 * Parses the canonical value of a number input in the display unit to exact millisatoshis.
 * Localized text ("1,2", "1 2", Arabic-Indic digits) is the browser's job and is rejected here,
 * never reinterpreted.
 */
export function parseAmountInput(value: string, unit: DisplayUnit, options: AmountInputOptions): AmountInputResult {
  const match = CANONICAL_INPUT.exec(value);
  if (!match) return { ok: false, error: value === '' ? 'Enter an amount.' : 'Enter a plain decimal amount.' };
  const whole = match[1] ?? '0';
  const fraction = match[2] ?? match[3] ?? '';

  const scale = UNIT_SCALE[unit];
  if (fraction.length > scale) return { ok: false, error: 'Too many decimal places.' };
  const msat = BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0'));

  if (!options.allowMsat && msat % MSAT_PER_SAT !== 0n) return { ok: false, error: 'Use whole satoshis.' };
  if (msat > I64_MAX) return { ok: false, error: 'Amount is too large.' };
  if (msat === 0n) return { ok: false, error: 'Enter an amount greater than zero.' };
  return { ok: true, msat };
}

export type IntegerInputResult = { ok: true; value: bigint } | { ok: false; error: string };

/** Parses the canonical value of a whole-number input, such as a fee rate in sat/vB. */
export function parsePositiveIntegerInput(input: string): IntegerInputResult {
  if (!/^[0-9]+$/.test(input)) return { ok: false, error: 'Enter a whole number.' };
  const value = BigInt(input);
  if (value === 0n) return { ok: false, error: 'Enter a number greater than zero.' };
  if (value > I64_MAX) return { ok: false, error: 'Number is too large.' };
  return { ok: true, value };
}

export function isWithin(value: bigint, bounds: { min: string; max: string }): boolean {
  return value >= parseWireDecimal(bounds.min) && value <= parseWireDecimal(bounds.max);
}
