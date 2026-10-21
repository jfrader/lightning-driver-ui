import type { AmountBounds } from '../../api/types';
import {
  formatMsat,
  isWithin,
  parseAmountInput,
  parsePositiveIntegerInput,
  wireToMsat,
  type WireUnit,
} from '../../lib/money';
import type { AmountEntry } from './AmountField';

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

interface AmountRules {
  allowMsat: boolean;
  bounds: AmountBounds;
  boundsUnit: WireUnit;
}

/** Exact amount in millisatoshis within the node's configured bounds. */
export function checkAmount(entry: AmountEntry, rules: AmountRules): Checked<bigint> {
  const parsed = parseAmountInput(entry.text, entry.unit, { allowMsat: rules.allowMsat });
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const min = wireToMsat(rules.bounds.min, rules.boundsUnit);
  const max = wireToMsat(rules.bounds.max, rules.boundsUnit);
  if (parsed.msat < min || parsed.msat > max) {
    return { ok: false, error: `Enter between ${formatMsat(min, entry.unit)} and ${formatMsat(max, entry.unit)}.` };
  }
  return { ok: true, value: parsed.msat };
}

/** Whole sat/vB rate within the node's configured fee-rate bounds. */
export function checkFeeRate(text: string, bounds: AmountBounds): Checked<bigint> {
  const parsed = parsePositiveIntegerInput(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  if (!isWithin(parsed.value, bounds)) {
    return { ok: false, error: `Enter between ${bounds.min} and ${bounds.max} sat/vB.` };
  }
  return { ok: true, value: parsed.value };
}
