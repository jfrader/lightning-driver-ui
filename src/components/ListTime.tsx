import { styled } from '@jfrader/ui';
import { formatListTime } from '../lib/time';
import { useNow } from '../lib/use-now';
import { Mono } from './text';

const Clock = styled(Mono)({ whiteSpace: 'nowrap' });

/** A list time in UTC: time today, date and time otherwise; the full timestamp in the title. */
export function ListTime({ at }: { at: string }) {
  const now = useNow();
  return (
    <span title={at} style={{ whiteSpace: 'nowrap' }}>
      <Clock>{formatListTime(at, now) ?? at}</Clock> UTC
    </span>
  );
}
