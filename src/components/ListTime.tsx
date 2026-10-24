import { styled } from '@jfrader/ui';
import { formatListTime } from '../lib/time';
import { useNow } from '../lib/use-now';

const Mono = styled.span(({ theme }) => ({ fontFamily: theme.font.mono, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }));

/** A list time in UTC: time today, date and time otherwise; the full timestamp in the title. */
export function ListTime({ at }: { at: string }) {
  const now = useNow();
  return (
    <span title={at} style={{ whiteSpace: 'nowrap' }}>
      <Mono>{formatListTime(at, now) ?? at}</Mono> UTC
    </span>
  );
}
