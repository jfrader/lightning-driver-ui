import { Flex } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { invoicesQueryOptions } from '../../api/node-queries';
import type { Invoice } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { CopyValue } from '../../components/CopyValue';
import { FilterSelect } from '../../components/FilterSelect';
import { PageHeader } from '../../components/PageHeader';
import { PagedList } from '../../components/PagedList';
import type { ResourceColumn } from '../../components/ResourceList';
import { DateTimeText } from '../../components/DateTimeText';
import { Amount } from '../display/Amount';
import { CapabilityAction } from '../nodes/CapabilityAction';
import { useCurrentNode } from '../nodes/use-current-node';
import { INVOICE_STATE } from './labels';

const route = getRouteApi('/_authed/nodes/$nodeId/invoices');

const COLUMNS: readonly ResourceColumn<Invoice>[] = [
  { id: 'created', header: 'Created', cell: (invoice) => <DateTimeText value={invoice.created_at} /> },
  { id: 'amount', header: 'Amount', numeric: true, cell: (invoice) => <Amount value={invoice.amount_msat} unit="msat" /> },
  { id: 'received', header: 'Received', numeric: true, cell: (invoice) => <Amount value={invoice.received_msat} unit="msat" /> },
  { id: 'state', header: 'State', cell: (invoice) => INVOICE_STATE[invoice.state] },
  { id: 'description', header: 'Description', cell: (invoice) => invoice.description ?? '—' },
  {
    id: 'invoice',
    header: 'Invoice',
    cell: (invoice) => (invoice.bolt11 ? <CopyValue value={invoice.bolt11} label="Invoice" /> : 'Not available'),
  },
];

export function InvoicesPage() {
  const node = useCurrentNode();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const invoices = useQuery(invoicesQueryOptions(node.id, { status: search.status, cursor: search.cursor }));
  return (
    <Flex direction="column" gap="md">
      <PageHeader
        title="Invoices"
        actions={
          <CapabilityAction node={node} capability="create_invoice">
            <ButtonLink to="/nodes/$nodeId/invoices/new" params={{ nodeId: node.id }} tone="accent">
              Receive
            </ButtonLink>
          </CapabilityAction>
        }
      />
      <FilterSelect
        label="State"
        labels={INVOICE_STATE}
        value={search.status}
        onChange={(status) => void navigate({ search: { status } })}
      />
      <PagedList
        caption="Invoices"
        query={invoices}
        columns={COLUMNS}
        getRowId={(invoice) => invoice.payment_hash}
        emptyTitle="No invoices"
        cursor={search.cursor}
        onCursor={(cursor) => void navigate({ search: (previous) => ({ ...previous, cursor }) })}
      />
    </Flex>
  );
}
