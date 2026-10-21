import { styled } from '@jfrader/ui';
import { useChartColors, type ChartTone } from '../appearance/appearance-context';

const Mark = styled.span<{ swatch: string }>(({ swatch }) => ({
  display: 'inline-block',
  flexShrink: 0,
  inlineSize: '0.625rem',
  blockSize: '0.625rem',
  marginInlineEnd: '0.4rem',
  borderRadius: '1px',
  backgroundColor: swatch,
  // Forced colors drops backgrounds; the key must keep matching the bar it explains.
  forcedColorAdjust: 'none',
}));

/** Colour key beside the label it explains, so the composition bar needs no separate legend. */
export function ShareSwatch({ tone }: { tone: ChartTone }) {
  return <Mark swatch={useChartColors()[tone]} aria-hidden="true" />;
}
