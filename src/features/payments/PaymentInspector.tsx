import { styled } from '@jfrader/ui';
import type { Payment } from '../../api/types';
import { DetailList } from '../../components/DetailList';
import { Section } from '../../components/Section';
import { LiveUtcTime, UtcTime } from '../../components/UtcTime';
import { Amount } from '../display/Amount';
import { FeeRatio } from '../display/FeeRatio';
import { Identifier } from '../display/Identifier';
import { NotReported } from '../display/NotReported';
import { PaymentState } from './PaymentState';

const Mono = styled.span(({ theme }) => ({ fontFamily: theme.font.mono, fontSize: theme.textSize.sm }));

const Note = styled.p(({ theme }) => ({ margin: 0, fontSize: theme.textSize.sm, color: theme.color.textMuted }));

interface PaymentInspectorProps {
  /** The selected record, or `null` when the selected hash is not on the loaded page. */
  payment: Payment | null;
  close: React.ReactNode;
}

/** The selected payment's facts with full, copyable identifiers. Read-only: no retry, no pay again. */
export function PaymentInspector({ payment, close }: PaymentInspectorProps) {
  if (!payment) {
    return (
      <Section title="Payment" action={close}>
        <Note>This payment is not on the loaded page.</Note>
      </Section>
    );
  }
  return (
    <Section title="Payment" action={close}>
      <DetailList
        items={[
          { label: 'State', value: <PaymentState state={payment.state} /> },
          { label: 'Amount', numeric: true, value: <Amount value={payment.amount_msat} unit="msat" /> },
          { label: 'Fee', numeric: true, value: <Amount value={payment.fee_msat} unit="msat" /> },
          {
            label: 'Fee / amount',
            numeric: true,
            value: <FeeRatio feeMsat={payment.fee_msat} amountMsat={payment.amount_msat} />,
          },
          { label: 'Created', value: <LiveUtcTime value={payment.created_at} /> },
          { label: 'Completed', value: <UtcTime value={payment.completed_at} /> },
          {
            label: 'Destination',
            stacked: true,
            value: payment.destination ? <Identifier value={payment.destination} label="Destination" /> : <NotReported />,
          },
          { label: 'Payment hash', stacked: true, value: <Identifier value={payment.payment_hash} label="Payment hash" /> },
          { label: 'Node state', value: <Mono>{payment.backend_state}</Mono> },
        ]}
      />
    </Section>
  );
}
