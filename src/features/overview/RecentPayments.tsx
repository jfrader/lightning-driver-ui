import { useCallback, useMemo, type ReactNode } from 'react';
import { EmptyState } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { paymentsQueryOptions } from '../../api/node-queries';
import type { Payment } from '../../api/types';
import { ButtonLink } from '../../components/ButtonLink';
import { ErrorNotice } from '../../components/ErrorNotice';
import { LoadingState } from '../../components/LoadingState';
import { ResourceList } from '../../components/ResourceList';
import { Section } from '../../components/Section';
import { ROW_PRIMARY_LINK } from '../../components/row-link';
import { TextLink } from '../../components/TextLink';
import { VisuallyHidden } from '../../components/VisuallyHidden';
import { RECENT_PAYMENTS_LIMIT } from '../../config';
import { paymentColumns } from '../payments/payment-columns';
import { PaymentRow } from '../payments/PaymentRow';
import { useControlSize } from '../shell/use-shell-layout';

const getRowId = (payment: Payment) => payment.payment_hash;

/** The newest payments as the node reports them; each opens in the Payments inspector. */
export function RecentPayments({ nodeId }: { nodeId: string }) {
  const size = useControlSize();
  const payments = useQuery(paymentsQueryOptions(nodeId, {}, { pageSize: RECENT_PAYMENTS_LIMIT }));
  const open = useCallback((payment: Payment, label: ReactNode) => (
    <TextLink
      to="/nodes/$nodeId/payments"
      params={{ nodeId }}
      search={{ selected: payment.payment_hash }}
      {...ROW_PRIMARY_LINK}
    >
      {label}
      <VisuallyHidden>{` (Open payment ${payment.payment_hash.slice(0, 8)})`}</VisuallyHidden>
    </TextLink>
  ), [nodeId]);
  const columns = useMemo(() => paymentColumns(open), [open]);
  const renderRow = useCallback((payment: Payment) => <PaymentRow payment={payment} open={open} />, [open]);

  return (
    <Section
      title="Recent payments"
      action={
        <ButtonLink to="/nodes/$nodeId/payments" params={{ nodeId }} search={{}} size={size} variant="ghost">
          All payments
        </ButtonLink>
      }
    >
      {payments.isPending && <LoadingState label="Loading recent payments" />}
      {payments.isError && <ErrorNotice error={payments.error} stale={payments.data !== undefined} onRetry={() => void payments.refetch()} />}
      {payments.data &&
        (payments.data.items.length === 0 ? (
          <EmptyState variant="inline" title="No payments on this node." />
        ) : (
          <ResourceList
            caption="Recent payments"
            rows={payments.data.items}
            columns={columns}
            getRowId={getRowId}
            renderRow={renderRow}
          />
        ))}
    </Section>
  );
}
