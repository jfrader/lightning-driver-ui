import { Flex, Pill, styled } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { operationsQueryOptions } from '../../api/node-queries';
import type { Operation } from '../../api/types';
import { FilterSelect } from '../../components/FilterSelect';
import { PageHeader } from '../../components/PageHeader';
import { PagedList } from '../../components/PagedList';
import type { ResourceColumn } from '../../components/ResourceList';
import { ListTime } from '../../components/ListTime';
import { ROW_PRIMARY_LINK } from '../../components/row-link';
import { TextLink } from '../../components/TextLink';
import { useNow } from '../../lib/use-now';
import { OPERATION_KIND, OPERATION_LIST_STATE, OPERATION_STAGE, outcomeLabel } from './labels';
import { OperationAmount } from './OperationAmount';

const route = getRouteApi('/_authed/nodes/$nodeId/operations');

const Stage = styled.span(({ theme }) => ({ fontSize: theme.textSize.xs, color: theme.color.textMuted }));

const RowBody = styled.div(({ theme }) => ({ display: 'grid', gap: theme.space[1], minInlineSize: 0 }));

const Line = styled.div(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  columnGap: theme.space[3],
  rowGap: theme.space[1],
}));

function ActionLink({ operation }: { operation: Operation }) {
  return (
    <TextLink
      to="/nodes/$nodeId/operations/$operationId"
      params={{ nodeId: operation.node_id, operationId: operation.id }}
      {...ROW_PRIMARY_LINK}
    >
      {OPERATION_KIND[operation.request.kind]}
    </TextLink>
  );
}

function OutcomePill({ operation }: { operation: Operation }) {
  const outcome = outcomeLabel(operation);
  return <Pill tone={outcome.tone}>{outcome.label}</Pill>;
}

function columns(now: number): ResourceColumn<Operation>[] {
  return [
    {
      id: 'created',
      header: 'Created (UTC)',
      width: '9rem',
      cell: (operation) => <ListTime at={operation.created_at} now={now} />,
    },
    { id: 'kind', header: 'Action', cell: (operation) => <ActionLink operation={operation} /> },
    { id: 'state', header: 'State', cell: (operation) => <OutcomePill operation={operation} /> },
    { id: 'stage', header: 'Stage', cell: (operation) => <Stage>{OPERATION_STAGE[operation.stage]}</Stage> },
    { id: 'amount', header: 'Amount', numeric: true, cell: (operation) => <OperationAmount operation={operation} /> },
  ];
}

function OperationRow({ operation, now }: { operation: Operation; now: number }) {
  return (
    <RowBody>
      <Line>
        <ActionLink operation={operation} />
        <OutcomePill operation={operation} />
      </Line>
      <Line>
        <OperationAmount operation={operation} />
        <ListTime at={operation.created_at} now={now} />
      </Line>
      <Stage>{OPERATION_STAGE[operation.stage]}</Stage>
    </RowBody>
  );
}

function emptyTitle(state: string | undefined, kind: string | undefined): string {
  if (state === 'nonterminal' && !kind) return 'No unresolved operations.';
  if (!state && !kind) return 'No operations on this node.';
  return 'No operations match these filters.';
}

/** The durable journal: survives restarts and re-login, and stays readable on read-only and former nodes. */
export function OperationsPage() {
  const now = useNow();
  const { nodeId } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const operations = useQuery(
    operationsQueryOptions(nodeId, { state: search.state, kind: search.kind, cursor: search.cursor }),
  );
  return (
    <Flex direction="column" gap="md">
      <PageHeader title="Operations" />
      <Flex wrap gap="sm">
        <FilterSelect
          label="State"
          labels={OPERATION_LIST_STATE}
          value={search.state}
          onChange={(state) => void navigate({ search: (previous) => ({ ...previous, state, cursor: undefined }) })}
        />
        <FilterSelect
          label="Action"
          labels={OPERATION_KIND}
          value={search.kind}
          onChange={(kind) => void navigate({ search: (previous) => ({ ...previous, kind, cursor: undefined }) })}
        />
      </Flex>
      <PagedList
        caption="Operations"
        query={operations}
        columns={columns(now)}
        getRowId={(operation) => operation.id}
        renderRow={(operation) => <OperationRow operation={operation} now={now} />}
        emptyTitle={emptyTitle(search.state, search.kind)}
        cursor={search.cursor}
        onCursor={(cursor) => void navigate({ search: (previous) => ({ ...previous, cursor }) })}
      />
    </Flex>
  );
}
