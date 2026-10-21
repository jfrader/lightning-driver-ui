// Display-only ratios between exact msat amounts. The operands always stay on screen beside them.
import { DISPLAY_LOCALE } from '../config';
import { AmountError, isDecimalLiteral } from './money';

/** Fixed-point scale for a ratio; its rounded label never feeds arithmetic. */
const RATIO_SCALE = 10n ** 12n;
/** Shares are tenths of a percent: 1000 tenths make 100.0%. */
const WHOLE_TENTHS = 1000n;

/** `part / whole` as a percentage label with two significant digits ("0.04%"); `null` for a zero whole. */
export function formatRatio(partMsat: bigint, wholeMsat: bigint, locale: Intl.LocalesArgument = DISPLAY_LOCALE): string | null {
  if (wholeMsat === 0n) return null;
  const fraction = Number((partMsat * RATIO_SCALE) / wholeMsat) / Number(RATIO_SCALE);
  return new Intl.NumberFormat(locale, { style: 'percent', maximumSignificantDigits: 2 }).format(fraction);
}

/**
 * Two parts as one-decimal shares of their sum that always add up to 100.0%: the second is
 * rounded half up, the first is its complement, so 99.95/0.05 never prints as 100.0/0.1.
 * `null` when the sum is zero.
 */
export function complementaryShares(first: bigint, second: bigint): readonly [bigint, bigint] | null {
  const total = first + second;
  if (total === 0n) return null;
  const secondTenths = (second * WHOLE_TENTHS * 2n + total) / (total * 2n);
  return [WHOLE_TENTHS - secondTenths, secondTenths];
}

/** Tenths of a percent as a one-decimal percentage ("99.5%"), formatted from an exact decimal. */
export function formatShare(tenths: bigint, locale: Intl.LocalesArgument = DISPLAY_LOCALE): string {
  const fraction = `${tenths / WHOLE_TENTHS}.${(tenths % WHOLE_TENTHS).toString().padStart(3, '0')}`;
  if (!isDecimalLiteral(fraction)) throw new AmountError(`Cannot format ${fraction}.`);
  return new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    fraction,
  );
}

/** Chart geometry only: msat as a float sat value. Never rendered, never used for arithmetic. */
export function chartGeometry(msat: bigint): number {
  return Number(msat) / 1000;
}
