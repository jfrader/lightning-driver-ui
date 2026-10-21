import { Flex } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { paymentsQueryOptions } from '../../api/node-queries';
import type { Payment } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { CopyValue } from '../../components/CopyValue';
import { DateTimeText } from '../../components/DateTimeText';
import { FilterSelect } from '../../components/FilterSelect';
import { PageHeader } from '../../components/PageHeader';
import { PagedList } from '../../components/PagedList';
import type { ResourceColumn } from '../../components/ResourceList';
import { Amount } from '../display/Amount';
import { CapabilityAction } from '../nodes/CapabilityAction';
import { useCurrentNode } from '../nodes/use-current-node';
import { PAYMENT_STATE } from './labels';

const route = getRouteApi('/_authed/nodes/$nodeId/payments');

const COLUMNS: readonly ResourceColumn<Payment>[] = [
  { id: 'created', header: 'Created', cell: (payment) => <DateTimeText value={payment.created_at} /> },
  { id: 'amount', header: 'Amount', numeric: true, cell: (payment) => <Amount value={payment.amount_msat} unit="msat" /> },
  { id: 'fee', header: 'Fee', numeric: true, cell: (payment) => <Amount value={payment.fee_msat} unit="msat" /> },
  { id: 'state', header: 'State', cell: (payment) => PAYMENT_STATE[payment.state] },
  {
    id: 'destination',
    header: 'Destination',
    cell: (payment) => (payment.destination ? <CopyValue value={payment.destination} label="Destination" /> : 'Not reported'),
  },
  { id: 'hash', header: 'Payment hash', cell: (payment) => <CopyValue value={payment.payment_hash} label="Payment hash" /> },
];

export function PaymentsPage() {
  const node = useCurrentNode();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const payments = useQuery(paymentsQueryOptions(node.id, { status: search.status, cursor: search.cursor }));
  return (
    <Flex direction="column" gap="md">
      <PageHeader
        title="Payments"
        actions={
          <CapabilityAction node={node} capability="pay_invoice">
            <ButtonLink to="/nodes/$nodeId/payments/new" params={{ nodeId: node.id }} tone="accent">
              Pay invoice
            </ButtonLink>
          </CapabilityAction>
        }
      />
      <FilterSelect
        label="State"
        labels={PAYMENT_STATE}
        value={search.status}
        onChange={(status) => void navigate({ search: { status } })}
      />
      <PagedList
        caption="Payments"
        query={payments}
        columns={COLUMNS}
        getRowId={(payment) => payment.payment_hash}
        emptyTitle="No payments"
        cursor={search.cursor}
        onCursor={(cursor) => void navigate({ search: (previous) => ({ ...previous, cursor }) })}
      />
    </Flex>
  );
}
