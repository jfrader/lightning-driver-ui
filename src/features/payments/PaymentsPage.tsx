import type { ReactNode } from 'react';
import { Flex } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { paymentsQueryOptions } from '../../api/node-queries';
import type { Payment } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { FilterSelect } from '../../components/FilterSelect';
import { PageHeader } from '../../components/PageHeader';
import { PagedList } from '../../components/PagedList';
import { TextLink } from '../../components/TextLink';
import { InspectorLayout } from '../../components/InspectorLayout';
import { isKeyOf } from '../../lib/guards';
import { useNow } from '../../lib/use-now';
import { CapabilityAction } from '../nodes/CapabilityAction';
import { useCurrentNode } from '../nodes/use-current-node';
import { useControlSize } from '../shell/use-shell-layout';
import { PAYMENT_STATE, PAYMENT_STATE_LABEL } from './labels';
import { PAYMENT_SORT, paymentColumns } from './payment-columns';
import { PaymentInspector } from './PaymentInspector';
import { PaymentRow } from './PaymentRow';

const route = getRouteApi('/_authed/nodes/$nodeId/_configured/payments');

/** One row per payment hash as the node reports them; filter, sort and selection live in the URL. */
export function PaymentsPage() {
  const node = useCurrentNode();
  const now = useNow();
  const size = useControlSize();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const payments = useQuery(paymentsQueryOptions(node.id, { status: search.status, cursor: search.cursor }));

  const open = (payment: Payment, label: ReactNode) => (
    <TextLink
      from="/nodes/$nodeId/payments"
      search={(previous) => ({ ...previous, selected: payment.payment_hash })}
      aria-label={`Open payment ${payment.payment_hash.slice(0, 8)}`}
    >
      {label}
    </TextLink>
  );
  const columns = paymentColumns(now, open);
  const sort = search.sort ? { columnId: search.sort, direction: search.dir ?? 'desc' } : null;
  const selected = search.selected
    ? (payments.data?.items.find((payment) => payment.payment_hash === search.selected) ?? null)
    : undefined;

  const list = (
    <Flex direction="column" gap="md">
      <FilterSelect
        label="State"
        labels={PAYMENT_STATE_LABEL}
        value={search.status}
        onChange={(status) => void navigate({ search: { status } })}
      />
      <PagedList
        caption="Payments"
        query={payments}
        columns={columns}
        getRowId={(payment) => payment.payment_hash}
        sort={sort}
        onSort={(next) =>
          void navigate({
            search: (previous) => ({
              ...previous,
              sort: next && isKeyOf(PAYMENT_SORT, next.columnId) ? next.columnId : undefined,
              dir: next?.direction,
            }),
            replace: true,
          })
        }
        renderRow={(payment) => <PaymentRow payment={payment} now={now} open={open} />}
        emptyTitle={search.status ? `No payments in state ${PAYMENT_STATE[search.status].label}.` : 'No payments on this node.'}
        cursor={search.cursor}
        onCursor={(cursor) => void navigate({ search: (previous) => ({ ...previous, cursor, selected: undefined }) })}
      />
    </Flex>
  );

  return (
    <Flex direction="column" gap="md">
      <PageHeader
        title="Payments"
        actions={
          <CapabilityAction node={node} capability="pay_invoice">
            <ButtonLink to="/nodes/$nodeId/payments/new" params={{ nodeId: node.id }} size={size} tone="accent" variant="solid">
              Pay invoice
            </ButtonLink>
          </CapabilityAction>
        }
      />
      <InspectorLayout
        list={list}
        inspectorLabel="Selected payment"
        inspector={
          selected === undefined || payments.isPending ? null : (
            <PaymentInspector
              payment={selected}
              now={now}
              close={
                <TextLink from="/nodes/$nodeId/payments" search={(previous) => ({ ...previous, selected: undefined })}>
                  Hide
                </TextLink>
              }
            />
          )
        }
      />
    </Flex>
  );
}
