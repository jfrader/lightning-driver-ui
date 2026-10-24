import type { Payment } from '../../api/types';
import { ListTime } from '../../components/ListTime';
import { ShortIdentifier } from '../display/Identifier';
import { NotReported } from '../display/NotReported';

/** Created time in UTC: time today, date and time otherwise. */
export function PaymentTime({ payment }: { payment: Payment }) {
  return <ListTime at={payment.created_at} />;
}

export function PaymentDestination({ payment }: { payment: Payment }) {
  return payment.destination ? <ShortIdentifier value={payment.destination} /> : <NotReported />;
}
