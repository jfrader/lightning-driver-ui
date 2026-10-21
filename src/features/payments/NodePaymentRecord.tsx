import { styled } from '@jfrader/ui';
import { useQuery } from '@tanstack/react-query';
import { paymentsQueryOptions } from '../../api/node-queries';
import { DetailList } from '../../components/DetailList';
import { ErrorNotice } from '../../components/ErrorNotice';
import { LoadingState } from '../../components/LoadingState';
import { Section } from '../../components/Section';
import { TextLink } from '../../components/TextLink';
import { UtcTime } from '../../components/UtcTime';
import { Amount } from '../display/Amount';
import { FeeRatio } from '../display/FeeRatio';
import { PaymentState } from './PaymentState';

const Note = styled.p(({ theme }) => ({ margin: 0, fontSize: theme.textSize.sm, color: theme.color.textMuted }));

interface NodePaymentRecordProps {
  nodeId: string;
  paymentHash: string;
}

/**
 * The node's own payment record with the same payment hash, the only identity that proves they
 * match. Looked up on the newest loaded payments page; the contract has no single-payment read.
 */
export function NodePaymentRecord({ nodeId, paymentHash }: NodePaymentRecordProps) {
  const payments = useQuery(paymentsQueryOptions(nodeId, {}));
  const record = payments.data?.items.find((item) => item.payment_hash === paymentHash);
  return (
    <Section title="Node payment record">
      {payments.isPending && <LoadingState label="Loading the node payment record" />}
      {payments.isError && <ErrorNotice error={payments.error} onRetry={() => void payments.refetch()} />}
      {payments.data && !record && <Note>The node reports no payment with this hash on the newest payments page.</Note>}
      {record && (
        <>
          <DetailList
            items={[
              { label: 'State', value: <PaymentState state={record.state} /> },
              { label: 'Amount', numeric: true, value: <Amount value={record.amount_msat} unit="msat" /> },
              { label: 'Fee paid', numeric: true, value: <Amount value={record.fee_msat} unit="msat" /> },
              {
                label: 'Fee / amount',
                numeric: true,
                value: <FeeRatio feeMsat={record.fee_msat} amountMsat={record.amount_msat} />,
              },
              { label: 'Recorded', value: <UtcTime value={record.created_at} /> },
            ]}
          />
          <TextLink to="/nodes/$nodeId/payments" params={{ nodeId }} search={{ selected: paymentHash }}>
            Open in Payments
          </TextLink>
        </>
      )}
    </Section>
  );
}
