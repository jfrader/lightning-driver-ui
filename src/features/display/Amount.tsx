import { styled } from '@jfrader/ui';
import { formatMsat, wireToMsat, type WireUnit } from '../../lib/money';
import { NotReported } from './NotReported';
import { useDisplayUnit } from './unit-context';

const Value = styled.span(({ theme }) => ({
  fontFamily: theme.font.mono,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
}));

interface AmountProps {
  /** Canonical wire decimal, or `null` when the node did not report it. */
  value: string | null;
  unit: WireUnit;
  className?: string;
}

/** Exact amount in the session unit. A missing value reads "Not reported", never zero. */
export function Amount({ value, unit, className }: AmountProps) {
  const { unit: displayUnit } = useDisplayUnit();
  if (value === null) return <NotReported />;
  return <Value className={className}>{formatMsat(wireToMsat(value, unit), displayUnit)}</Value>;
}

/** An exact msat amount already parsed (for derived figures such as an "at most" total). */
export function MsatAmount({ msat, className }: { msat: bigint; className?: string }) {
  const { unit } = useDisplayUnit();
  return <Value className={className}>{formatMsat(msat, unit)}</Value>;
}
