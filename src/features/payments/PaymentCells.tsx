import { styled } from '@jfrader/ui';
import type { Payment } from '../../api/types';
import { formatListTime } from '../../lib/time';
import { ShortIdentifier } from '../display/Identifier';
import { NotReported } from '../display/NotReported';

const Mono = styled.span(({ theme }) => ({
  fontFamily: theme.font.mono,
  fontSize: theme.textSize.sm,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
}));

/** Created time in UTC: time today, date and time otherwise. */
export function PaymentTime({ payment, now }: { payment: Payment; now: number }) {
  return <Mono title={payment.created_at}>{formatListTime(payment.created_at, now) ?? payment.created_at}</Mono>;
}

export function PaymentDestination({ payment }: { payment: Payment }) {
  return payment.destination ? <ShortIdentifier value={payment.destination} /> : <NotReported />;
}
