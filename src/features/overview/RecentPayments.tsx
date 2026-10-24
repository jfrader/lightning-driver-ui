import type { ReactNode } from 'react';
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
import { useNow } from '../../lib/use-now';
import { paymentColumns } from '../payments/payment-columns';
import { PaymentRow } from '../payments/PaymentRow';
import { useControlSize } from '../shell/use-shell-layout';

/** The newest payments as the node reports them; each opens in the Payments inspector. */
export function RecentPayments({ nodeId }: { nodeId: string }) {
  const now = useNow();
  const size = useControlSize();
  const payments = useQuery(paymentsQueryOptions(nodeId, { limit: String(RECENT_PAYMENTS_LIMIT) }));
  const open = (payment: Payment, label: ReactNode) => (
    <TextLink
      to="/nodes/$nodeId/payments"
      params={{ nodeId }}
      search={{ selected: payment.payment_hash }}
      {...ROW_PRIMARY_LINK}
    >
      {label}
      <VisuallyHidden>{` (Open payment ${payment.payment_hash.slice(0, 8)})`}</VisuallyHidden>
    </TextLink>
  );

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
      {payments.isError && <ErrorNotice error={payments.error} onRetry={() => void payments.refetch()} />}
      {payments.data &&
        (payments.data.items.length === 0 ? (
          <EmptyState variant="inline" title="No payments on this node." />
        ) : (
          <ResourceList
            caption="Recent payments"
            rows={payments.data.items}
            columns={paymentColumns(now, open)}
            getRowId={(payment) => payment.payment_hash}
            renderRow={(payment) => <PaymentRow payment={payment} now={now} open={open} />}
          />
        ))}
    </Section>
  );
}
