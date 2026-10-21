import { styled } from '@jfrader/ui';
import { ShareBar } from '../../components/ShareBar';
import { formatMsat, wireToMsat, type WireUnit } from '../../lib/money';
import { complementaryShares, formatShare } from '../../lib/ratio';
import { useDisplayUnit } from '../display/unit-context';

const Block = styled.div(({ theme }) => ({ display: 'grid', gap: theme.space[1], paddingBlockStart: theme.space[2] }));

const Shares = styled.p(({ theme }) => ({
  margin: 0,
  fontSize: theme.textSize.xs,
  color: theme.color.textMuted,
  fontVariantNumeric: 'tabular-nums',
}));

interface Part {
  label: string;
  value: string | null;
  unit: WireUnit;
}

/**
 * Two reported balances as shares of their sum. Absent when either is not reported or both are
 * zero: a missing value is never drawn as zero. Shares are complementary and sum to 100.0%.
 */
export function BalanceComposition({ title, first, second }: { title: string; first: Part; second: Part }) {
  const { unit } = useDisplayUnit();
  if (first.value === null || second.value === null) return null;
  const parts = [
    { id: 'first', label: first.label, msat: wireToMsat(first.value, first.unit), tone: 'primary' as const },
    { id: 'second', label: second.label, msat: wireToMsat(second.value, second.unit), tone: 'secondary' as const },
  ];
  const shares = complementaryShares(parts[0].msat, parts[1].msat);
  if (shares === null) return null;
  return (
    <Block>
      <ShareBar
        label={`${title} composition`}
        summary={parts.map((part) => `${part.label} ${formatMsat(part.msat, unit)}`).join(', ')}
        totalMsat={parts[0].msat + parts[1].msat}
        parts={parts}
      />
      <Shares>{parts.map((part, index) => `${part.label} ${formatShare(shares[index])}`).join(' · ')}</Shares>
    </Block>
  );
}
