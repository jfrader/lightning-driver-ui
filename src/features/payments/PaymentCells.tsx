import type { Payment } from '../../api/types';
import { ListTime } from '../../components/ListTime';
import { ShortIdentifier } from '../display/Identifier';
import { NotReported } from '../display/NotReported';

/** Created time in UTC: time today, date and time otherwise. */
export function PaymentTime({ payment, now }: { payment: Payment; now: number }) {
  return <ListTime at={payment.created_at} now={now} />;
}

export function PaymentDestination({ payment }: { payment: Payment }) {
  return payment.destination ? <ShortIdentifier value={payment.destination} /> : <NotReported />;
}
