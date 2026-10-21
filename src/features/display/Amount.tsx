import { styled } from '@jfrader/ui';
import { formatMsat, wireToMsat, type WireUnit } from '../../lib/money';
import { useDisplayUnit } from './unit-context';

const Value = styled.span({ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' });
const Missing = styled.span(({ theme }) => ({ color: theme.color.textMuted }));

interface AmountProps {
  /** Canonical wire decimal, or `null` when the node did not report it. */
  value: string | null;
  unit: WireUnit;
}

/** Exact amount in the session unit. A missing value reads "Unavailable", never zero. */
export function Amount({ value, unit }: AmountProps) {
  const { unit: displayUnit } = useDisplayUnit();
  if (value === null) return <Missing>Unavailable</Missing>;
  return <Value>{formatMsat(wireToMsat(value, unit), displayUnit)}</Value>;
}
