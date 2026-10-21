// The only module that imports Recharts. It is loaded lazily through `components/ShareBar`, so the
// chart library stays out of the initial route chunk.
import { Bar, BarChart, XAxis, YAxis } from 'recharts';

export interface ShareBarSegment {
  id: string;
  /** Geometry only (a float); the exact amounts are printed beside the bar. */
  value: number;
  fill: string;
}

export interface ShareBarChartProps {
  total: number;
  segments: readonly ShareBarSegment[];
  height: number;
  separator: string;
}

const NO_MARGIN = { top: 0, right: 0, bottom: 0, left: 0 };
const ROW_KEY = 'row';

/** One horizontal stacked bar over an explicit [0, total] domain: no axes, grid, tooltip, legend or animation. */
export default function ShareBarChart({ total, segments, height, separator }: ShareBarChartProps) {
  const row = Object.fromEntries([['name', ROW_KEY], ...segments.map((segment) => [segment.id, segment.value])]);
  return (
    <BarChart
      layout="vertical"
      data={[row]}
      responsive
      width="100%"
      height={height}
      margin={NO_MARGIN}
      barCategoryGap={0}
      accessibilityLayer={false}
    >
      <XAxis type="number" domain={[0, total]} hide allowDataOverflow />
      <YAxis type="category" dataKey="name" hide />
      {segments.map((segment) => (
        <Bar
          key={segment.id}
          dataKey={segment.id}
          stackId="share"
          fill={segment.fill}
          stroke={separator}
          strokeWidth={1}
          isAnimationActive={false}
        />
      ))}
    </BarChart>
  );
}
