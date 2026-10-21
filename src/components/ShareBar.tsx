import { Suspense, lazy } from 'react';
import { styled } from '@jfrader/ui';
import { SHARE_BAR_HEIGHT } from '../config';
import { useChartColors, type ChartTone } from '../features/appearance/appearance-context';
import { chartGeometry } from '../lib/ratio';

const ShareBarChart = lazy(() => import('../charts/ShareBarChart'));

const Frame = styled.div({ inlineSize: '100%', blockSize: SHARE_BAR_HEIGHT, minInlineSize: 0 });

export interface SharePart {
  id: string;
  msat: bigint;
  tone: ChartTone;
}

interface ShareBarProps {
  /** Accessible name and text summary of every value; the chart is never the only carrier. */
  label: string;
  summary: string;
  totalMsat: bigint;
  parts: readonly SharePart[];
}

/**
 * Stacked composition bar. The frame reserves its height before the chart chunk loads, so nothing
 * shifts; it is one image whose name carries the same numbers printed beside it.
 */
export function ShareBar({ label, summary, totalMsat, parts }: ShareBarProps) {
  const colors = useChartColors();
  return (
    <Frame role="img" aria-label={`${label}: ${summary}`}>
      <Suspense fallback={null}>
        <ShareBarChart
          height={SHARE_BAR_HEIGHT}
          total={chartGeometry(totalMsat)}
          separator={colors.separator}
          segments={parts.map((part) => ({ id: part.id, value: chartGeometry(part.msat), fill: colors[part.tone] }))}
        />
      </Suspense>
    </Frame>
  );
}
