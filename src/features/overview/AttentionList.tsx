import { styled } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { operationsQueryOptions } from '../../api/node-queries';
import type { Operation } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { ErrorNotice } from '../../components/ErrorNotice';
import { Section } from '../../components/Section';
import { formatAge, formatClockTime } from '../../lib/time';
import { useNow } from '../../lib/use-now';
import { Amount } from '../display/Amount';
import { UNRESOLVED_SENTENCE, isInFlight } from '../operations/labels';
import { useControlSize } from '../shell/use-shell-layout';

const List = styled.ul(({ theme }) => ({ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: theme.space[3] }));

const Item = styled.li(({ theme }) => ({
  display: 'grid',
  gap: theme.space[2],
  paddingBlock: theme.space[3],
  paddingInline: theme.space[4],
  backgroundColor: theme.color.warningSoft,
  border: `1px solid ${theme.color.border}`,
  borderInlineStart: `3px solid ${theme.color.warning}`,
  borderRadius: theme.radius.sm,
}));

const Line = styled.div(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  columnGap: theme.space[4],
  rowGap: theme.space[1],
}));

const Title = styled.h3(({ theme }) => ({
  margin: 0,
  fontSize: theme.textSize.md,
  fontWeight: theme.fontWeight.semibold,
  color: theme.color.warning,
}));

const Body = styled.p(({ theme }) => ({ margin: 0, fontSize: theme.textSize.sm }));

const Meta = styled.span(({ theme }) => ({ fontSize: theme.textSize.xs, color: theme.color.textMuted }));

const Mono = styled.span(({ theme }) => ({ fontFamily: theme.font.mono }));

function title(operation: Operation): string {
  const subject = operation.request.kind === 'pay_invoice' ? 'Payment' : 'Operation';
  return operation.state === 'unknown' ? `${subject} outcome unknown` : `${subject} pending`;
}

function LastChecked({ at, now }: { at: string | null; now: number }) {
  const clock = at === null ? null : formatClockTime(at);
  const age = at === null ? null : formatAge(at, now);
  if (!clock || !age) return <Meta>Not checked with the node yet</Meta>;
  return (
    <Meta>
      Last checked with the node <Mono>{clock}</Mono> UTC · {age}
    </Meta>
  );
}

/**
 * One item per operation the node may have acted on without a final outcome, newest first.
 * Each says what is known and what not to do, and links to the operation. Nothing here retries.
 */
export function AttentionList({ nodeId }: { nodeId: string }) {
  const now = useNow();
  const size = useControlSize();
  const operations = useQuery(operationsQueryOptions(nodeId, { state: 'nonterminal' }));
  if (operations.isError) {
    return (
      <Section title="Needs attention">
        <ErrorNotice error={operations.error} onRetry={() => void operations.refetch()} />
      </Section>
    );
  }
  const items = (operations.data?.items ?? [])
    .filter((operation) => isInFlight(operation.state))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  if (items.length === 0) return null;

  return (
    <Section title="Needs attention">
      <List>
        {items.map((operation) => {
          const sentence = UNRESOLVED_SENTENCE[operation.request.kind];
          const amount = operation.review.amount_msat ?? operation.review.amount_sat;
          return (
            <Item key={operation.id}>
              <Line>
                <Title>{title(operation)}</Title>
                {amount !== null && (
                  <Amount value={amount} unit={operation.review.amount_msat !== null ? 'msat' : 'sat'} />
                )}
              </Line>
              <Body>{operation.state === 'unknown' ? sentence.unknown : sentence.pending}</Body>
              <Line>
                <LastChecked at={operation.last_reconciled_at} now={now} />
                <ButtonLink
                  to="/nodes/$nodeId/operations/$operationId"
                  params={{ nodeId, operationId: operation.id }}
                  size={size}
                  variant="outline"
                >
                  View operation
                </ButtonLink>
              </Line>
            </Item>
          );
        })}
      </List>
    </Section>
  );
}
