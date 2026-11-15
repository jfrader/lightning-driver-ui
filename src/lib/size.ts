import { DISPLAY_LOCALE } from '../config';

/** Binary size units. `Intl` formats the number; it has no IEC byte units, so the suffix is a constant. */
const SIZE_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB'] as const;
const STEP = 1024;

/** A scalar class for a size: one decimal once the value leaves whole bytes. */
function sizeNumber(value: number, locale: Intl.LocalesArgument): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: value < 10 ? 1 : 0 }).format(value);
}

/**
 * A byte count in the unit a person reads ("652 GiB", "1.0 MiB"), using binary units. Values below
 * one KiB keep the exact byte count. The exact count stays available through `formatBytes`.
 */
export function formatByteSize(bytes: bigint, locale: Intl.LocalesArgument = DISPLAY_LOCALE): string {
  if (bytes < BigInt(STEP)) return formatBytes(bytes, locale);
  let value = Number(bytes);
  let unit = 0;
  while (value >= STEP && unit < SIZE_UNITS.length - 1) {
    value /= STEP;
    unit += 1;
  }
  return `${sizeNumber(value, locale)} ${SIZE_UNITS[unit]}`;
}

/** The exact count with its long unit ("9,007,199,254,740,993 bytes"). */
export function formatBytes(bytes: bigint, locale: Intl.LocalesArgument = DISPLAY_LOCALE): string {
  return new Intl.NumberFormat(locale, { style: 'unit', unit: 'byte', unitDisplay: 'long' }).format(bytes);
}
