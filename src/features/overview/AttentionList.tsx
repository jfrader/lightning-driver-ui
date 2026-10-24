import { styled } from '@jfrader/ui';
import { useOperationList } from '../operations/use-operation-list';
import type { Operation } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { ErrorNotice } from '../../components/ErrorNotice';
import { Section } from '../../components/Section';
import { isInFlight } from '../operations/labels';
import { LastChecked } from '../operations/LastChecked';
import { OperationAmount } from '../operations/OperationAmount';
import { operationSentence, reconciliationSentence } from '../operations/operation-sentence';
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

function title(operation: Operation): string {
  const subject = operation.request.kind === 'pay_invoice' ? 'Payment' : 'Operation';
  return operation.state === 'unknown' ? `${subject} outcome unknown` : `${subject} pending`;
}

/**
 * One item per operation the node may have acted on without a final outcome, newest first.
 * Each says what is known and what not to do, and links to the operation. Nothing here retries.
 */
export function AttentionList({ nodeId }: { nodeId: string }) {
  const size = useControlSize();
  const operations = useOperationList(nodeId, { state: 'nonterminal' });
  if (operations.isError && !operations.data) {
    return (
      <Section title="Needs attention">
        <ErrorNotice error={operations.error} onRetry={() => void operations.refetch()} />
      </Section>
    );
  }
  const items = (operations.data?.items ?? [])
    .filter((operation) => isInFlight(operation.state))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  if (items.length === 0 && !operations.isError) return null;

  return (
    <Section title="Needs attention">
      {operations.isError && <ErrorNotice error={operations.error} stale onRetry={() => void operations.refetch()} />}
      <List>
        {items.map((operation) => {
          const reconciliation = reconciliationSentence(operation);
          return (
            <Item key={operation.id}>
              <Line>
                <Title>{title(operation)}</Title>
                <OperationAmount operation={operation} />
              </Line>
              <Body>{operationSentence(operation)}</Body>
              {reconciliation !== null && <Body>{reconciliation}</Body>}
              <Line>
                <LastChecked at={operation.last_reconciled_at} />
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
