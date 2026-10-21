import { Pill, styled } from '@jfrader/ui';
import type { NodeSummary } from '../../api/types';
import { formatInteger, parseWireDecimal } from '../../lib/money';
import { formatAge, formatClockTime } from '../../lib/time';
import { useNow } from '../../lib/use-now';
import { NODE_STATUS } from '../nodes/labels';

const List = styled.ul(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  rowGap: theme.space[1],
  margin: 0,
  padding: 0,
  listStyle: 'none',
  fontSize: theme.textSize.xs,
  color: theme.color.textMuted,
  minInlineSize: 0,
}));

const Fact = styled.li(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space[1],
  paddingInline: theme.space[2],
  borderInlineStart: `1px solid ${theme.color.border}`,
  whiteSpace: 'nowrap',
  '&:first-of-type': { paddingInlineStart: 0, borderInlineStart: 'none' },
}));

const Strong = styled.span(({ theme }) => ({ color: theme.color.text, fontWeight: theme.fontWeight.medium }));

const Mono = styled.span(({ theme }) => ({ fontFamily: theme.font.mono, fontVariantNumeric: 'tabular-nums' }));

const Marker = styled.span<{ online: boolean }>(({ theme, online }) => ({
  inlineSize: '0.5rem',
  blockSize: '0.5rem',
  borderRadius: '1px',
  backgroundColor: online ? theme.color.success : theme.color.warning,
}));

interface StatusFactsProps {
  node: NodeSummary;
  /** Phone: the observation age only, to keep the status on one line. */
  compact: boolean;
}

/** Node state in one line beside the chooser, which already carries label and network. */
export function StatusFacts({ node, compact }: StatusFactsProps) {
  const { status } = node;
  return (
    <List aria-label="Node status">
      <Fact>
        <Strong>{node.read_only ? 'Read-only' : 'Writable'}</Strong>
      </Fact>
      <Fact>
        <Marker online={status.status === 'online'} aria-hidden="true" />
        {NODE_STATUS[status.status].label}
      </Fact>
      <Fact>
        {status.block_height === null ? (
          'Block not reported'
        ) : (
          <>
            Block <Mono>{formatInteger(parseWireDecimal(status.block_height))}</Mono>
          </>
        )}
      </Fact>
      <ObservedFact observedAt={status.observed_at} stale={status.stale} compact={compact} />
    </List>
  );
}

/** Registry freshness for screens not bound to a node (Fleet). */
export function RegistryFacts({ observedAt, stale }: { observedAt: string | null; stale: boolean }) {
  return (
    <List aria-label="Registry status">
      <ObservedFact observedAt={observedAt} stale={stale} compact={false} />
    </List>
  );
}

interface ObservedFactProps {
  observedAt: string | null;
  stale: boolean;
  compact: boolean;
}

/** Observation time (UTC) and age from one `now`; `Stale` when it is a cached observation. */
function ObservedFact({ observedAt, stale, compact }: ObservedFactProps) {
  const now = useNow();
  const clock = observedAt === null ? null : formatClockTime(observedAt);
  const age = observedAt === null ? null : formatAge(observedAt, now);
  return (
    <Fact>
      {stale && <Pill tone="warning">Stale</Pill>}
      {clock && age ? (
        <span>
          Observed{' '}
          {compact ? (
            <Mono>{age}</Mono>
          ) : (
            <>
              <Mono>{clock}</Mono> UTC · {age}
            </>
          )}
        </span>
      ) : (
        'Never observed'
      )}
    </Fact>
  );
}
