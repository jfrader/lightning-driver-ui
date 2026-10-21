import { ShareBar } from '../../components/ShareBar';
import { formatMsat } from '../../lib/money';
import { useDisplayUnit } from '../display/unit-context';
import { LIQUIDITY_PARTS, type ChannelLiquidity } from './liquidity';

interface LiquidityBarProps {
  name: string;
  liquidity: ChannelLiquidity;
  size?: 'inline' | 'detail';
}

/** Local, remote and the remainder against the channel's own capacity; never stretched to fill it. */
export function LiquidityBar({ name, liquidity, size }: LiquidityBarProps) {
  const { unit } = useDisplayUnit();
  const parts = LIQUIDITY_PARTS.filter((part) => liquidity[part.id] > 0n);
  const summary = [
    ...parts.map((part) => `${part.label} ${formatMsat(liquidity[part.id], unit)}`),
    `of ${formatMsat(liquidity.capacity, unit)} capacity`,
  ].join(', ');
  return (
    <ShareBar
      label={`Liquidity of channel ${name}`}
      summary={summary}
      totalMsat={liquidity.capacity}
      parts={parts.map((part) => ({ id: part.id, msat: liquidity[part.id], tone: part.tone }))}
      size={size}
    />
  );
}
