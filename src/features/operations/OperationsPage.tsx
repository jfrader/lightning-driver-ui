import { Flex, Pill } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { operationsQueryOptions } from '../../api/node-queries';
import type { Operation } from '../../api/types';
import { DateTimeText } from '../../components/DateTimeText';
import { FilterSelect } from '../../components/FilterSelect';
import { PageHeader } from '../../components/PageHeader';
import { PagedList } from '../../components/PagedList';
import type { ResourceColumn } from '../../components/ResourceList';
import { TextLink } from '../../components/TextLink';
import { Amount } from '../display/Amount';
import { OPERATION_KIND, OPERATION_LIST_STATE, outcomeLabel } from './labels';

const route = getRouteApi('/_authed/nodes/$nodeId/operations');

function amountCell(operation: Operation) {
  const { amount_msat: msat, amount_sat: sat } = operation.review;
  if (msat !== null) return <Amount value={msat} unit="msat" />;
  if (sat !== null) return <Amount value={sat} unit="sat" />;
  return '—';
}

const COLUMNS: readonly ResourceColumn<Operation>[] = [
  { id: 'created', header: 'Created', cell: (operation) => <DateTimeText value={operation.created_at} /> },
  {
    id: 'kind',
    header: 'Action',
    cell: (operation) => (
      <TextLink
        to="/nodes/$nodeId/operations/$operationId"
        params={{ nodeId: operation.node_id, operationId: operation.id }}
      >
        {OPERATION_KIND[operation.request.kind]}
      </TextLink>
    ),
  },
  {
    id: 'outcome',
    header: 'Status',
    cell: (operation) => {
      const outcome = outcomeLabel(operation);
      return <Pill tone={outcome.tone}>{outcome.label}</Pill>;
    },
  },
  { id: 'amount', header: 'Amount', numeric: true, cell: amountCell },
];

/** The durable journal: survives restarts and re-login, and stays readable on read-only and former nodes. */
export function OperationsPage() {
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
          label="Status"
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
        columns={COLUMNS}
        getRowId={(operation) => operation.id}
        emptyTitle="No operations"
        cursor={search.cursor}
        onCursor={(cursor) => void navigate({ search: (previous) => ({ ...previous, cursor }) })}
      />
    </Flex>
  );
}
