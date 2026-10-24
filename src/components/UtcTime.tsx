import { styled } from '@jfrader/ui';
import { NotReported } from '../features/display/NotReported';
import { formatAge, formatDetailTime } from '../lib/time';
import { useNow } from '../lib/use-now';

const Mono = styled.span(({ theme }) => ({ fontFamily: theme.font.mono, fontVariantNumeric: 'tabular-nums' }));

export function LiveUtcTime({ value }: { value: string | null }) {
  const now = useNow();
  return <UtcTime value={value} now={now} />;
}

interface UtcTimeProps {
  value: string | null;
  /** Adds the relative age from this instant. */
  now?: number;
}

/** A server timestamp in UTC with seconds, optionally with its age; `null` reads "Not reported". */
export function UtcTime({ value, now }: UtcTimeProps) {
  const text = value === null ? null : formatDetailTime(value);
  if (value === null || text === null) return <NotReported />;
  const age = now === undefined ? null : formatAge(value, now);
  return (
    <time dateTime={value}>
      <Mono>{text}</Mono> UTC{age && ` · ${age}`}
    </time>
  );
}
