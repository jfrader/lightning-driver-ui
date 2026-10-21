import { Flex, Pill, styled } from '@jfrader/ui';
import { formatAge, formatDateTime } from '../lib/time';
import { useNow } from '../lib/use-now';

const Muted = styled.span(({ theme }) => ({ color: theme.color.textMuted, fontSize: theme.textSize.sm }));

interface FreshnessProps {
  observedAt: string | null;
  stale: boolean;
}

/** When the data was observed, and whether it is a cached observation from an unreachable node. */
export function Freshness({ observedAt, stale }: FreshnessProps) {
  const now = useNow();
  const age = observedAt === null ? null : formatAge(observedAt, now);
  return (
    <Flex wrap gap="sm" align="center">
      {stale && <Pill tone="warning">Stale</Pill>}
      <Muted title={observedAt ? (formatDateTime(observedAt) ?? undefined) : undefined}>
        {age ? `Observed ${age}` : 'Never observed'}
      </Muted>
    </Flex>
  );
}
