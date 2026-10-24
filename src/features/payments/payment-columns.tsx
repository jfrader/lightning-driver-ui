import type { ReactNode } from 'react';
import type { Payment } from '../../api/types';
import type { ResourceColumn } from '../../components/ResourceList';
import { parseWireDecimal } from '../../lib/money';
import { Amount } from '../display/Amount';
import { FeeRatio } from '../display/FeeRatio';
import { PaymentDestination, PaymentTime } from './PaymentCells';
import { PaymentState } from './PaymentState';

/** Sortable columns, as accepted in the URL. */
export const PAYMENT_SORT = { time: 'Time', amount: 'Amount', fee: 'Fee' } as const;

function compareAmounts(a: string | null, b: string | null): number {
  if (a === null || b === null) return 0;
  const difference = parseWireDecimal(a) - parseWireDecimal(b);
  return difference === 0n ? 0 : difference > 0n ? 1 : -1;
}

/**
 * Contract columns: Time (UTC), State, Amount, Fee, Fee / amount, Destination. One row per payment
 * hash, as the node reports them. `open` wraps the time in the link that opens the record.
 */
export function paymentColumns(open: (payment: Payment, label: ReactNode) => ReactNode): ResourceColumn<Payment>[] {
  return [
    {
      id: 'time',
      header: 'Time (UTC)',
      width: '9rem',
      cell: (payment) => open(payment, <PaymentTime payment={payment} />),
      compare: (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
    },
    { id: 'state', header: 'State', width: '10rem', cell: (payment) => <PaymentState state={payment.state} /> },
    {
      id: 'amount',
      header: 'Amount',
      numeric: true,
      cell: (payment) => <Amount value={payment.amount_msat} unit="msat" />,
      compare: (a, b) => compareAmounts(a.amount_msat, b.amount_msat),
      isMissing: (payment) => payment.amount_msat === null,
    },
    {
      id: 'fee',
      header: 'Fee',
      numeric: true,
      cell: (payment) => <Amount value={payment.fee_msat} unit="msat" />,
      compare: (a, b) => compareAmounts(a.fee_msat, b.fee_msat),
      isMissing: (payment) => payment.fee_msat === null,
    },
    {
      id: 'ratio',
      header: 'Fee / amount',
      numeric: true,
      cell: (payment) => <FeeRatio feeMsat={payment.fee_msat} amountMsat={payment.amount_msat} />,
    },
    { id: 'destination', header: 'Destination', cell: (payment) => <PaymentDestination payment={payment} /> },
  ];
}
