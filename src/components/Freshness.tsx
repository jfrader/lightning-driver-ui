import { Flex, Pill } from '@jfrader/ui';
import { Muted } from './text';
import { formatAge, formatDateTime } from '../lib/time';
import { useNow } from '../lib/use-now';

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
      <Muted size="sm" title={observedAt ? (formatDateTime(observedAt) ?? undefined) : undefined}>
        {age ? `Observed ${age}` : 'Never observed'}
      </Muted>
    </Flex>
  );
}
