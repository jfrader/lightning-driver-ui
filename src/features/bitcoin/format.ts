import { formatInteger, parseWireDecimal } from '../../lib/money';
import { DISPLAY_LOCALE } from '../../config';

export function numberValue(value: string | null): string {
  return value === null ? 'Not reported' : formatInteger(parseWireDecimal(value));
}

export function unitValue(value: string | null, unit: 'byte' | 'second' | 'millisecond'): string {
  return value === null
    ? 'Not reported'
    : new Intl.NumberFormat(DISPLAY_LOCALE, { style: 'unit', unit, unitDisplay: 'long' }).format(
        parseWireDecimal(value),
      );
}
