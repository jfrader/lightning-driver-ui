import { formatMsat, wireToMsat, type WireUnit } from '../../lib/money';
import { Mono } from '../../components/text';
import { NotReported } from './NotReported';
import { useDisplayUnit } from './unit-context';

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
  return <Mono wrap className={className}>{formatMsat(wireToMsat(value, unit), displayUnit)}</Mono>;
}

/** An exact msat amount already parsed (for derived figures such as an "at most" total). */
export function MsatAmount({ msat, className }: { msat: bigint; className?: string }) {
  const { unit } = useDisplayUnit();
  return <Mono wrap className={className}>{formatMsat(msat, unit)}</Mono>;
}
