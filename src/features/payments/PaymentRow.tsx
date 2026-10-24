import type { ReactNode } from 'react';
import { styled } from '@jfrader/ui';
import type { Payment } from '../../api/types';
import { Amount } from '../display/Amount';
import { FeeRatio } from '../display/FeeRatio';
import { PaymentDestination, PaymentTime } from './PaymentCells';
import { PaymentState } from './PaymentState';

const Body = styled.div(({ theme }) => ({ display: 'grid', gap: theme.space[1], minInlineSize: 0 }));

const Line = styled.div(({ theme }) => ({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  columnGap: theme.space[3],
  rowGap: theme.space[1],
  minInlineSize: 0,
}));

const Lead = styled.span(({ theme }) => ({ fontSize: theme.textSize.md }));

const Small = styled.span(({ theme }) => ({
  display: 'inline-flex',
  flexWrap: 'wrap',
  gap: '0.4em',
  fontSize: theme.textSize.xs,
  color: theme.color.textMuted,
}));

interface PaymentRowProps {
  payment: Payment;
  open: (payment: Payment, label: ReactNode) => ReactNode;
}

/** Phone row: amount and state, then destination, then fee and time. */
export function PaymentRow({ payment, open }: PaymentRowProps) {
  return (
    <Body>
      <Line>
        <Lead>
          <Amount value={payment.amount_msat} unit="msat" />
        </Lead>
        <PaymentState state={payment.state} />
      </Line>
      <Line>
        <PaymentDestination payment={payment} />
        {open(payment, <PaymentTime payment={payment} />)}
      </Line>
      <Small>
        <span>Fee</span>
        <Amount value={payment.fee_msat} unit="msat" />
        <FeeRatio feeMsat={payment.fee_msat} amountMsat={payment.amount_msat} />
      </Small>
    </Body>
  );
}
