import { styled } from '@jfrader/ui';
import type { Transaction } from '../../api/types';
import { ListTime } from '../../components/ListTime';
import { NotReported } from '../display/NotReported';
import { StateWord } from '../display/StateWord';
import { blockLabel, confirmationsLabel, DIRECTION } from './labels';

const Mono = styled.span(({ theme }) => ({ fontFamily: theme.font.mono, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }));

export function TransactionDirection({ transaction }: { transaction: Transaction }) {
  return <StateWord state={DIRECTION[transaction.direction]} />;
}

export function TransactionConfirmations({ transaction }: { transaction: Transaction }) {
  const label = confirmationsLabel(transaction.confirmations);
  return label ? <StateWord state={label} /> : <NotReported />;
}

export function TransactionBlock({ transaction }: { transaction: Transaction }) {
  const label = blockLabel(transaction);
  if (label === null) return <NotReported />;
  return transaction.block_height === null ? <span>{label}</span> : <Mono>{label}</Mono>;
}

export function TransactionTime({ transaction }: { transaction: Transaction }) {
  return transaction.occurred_at === null ? <NotReported /> : <ListTime at={transaction.occurred_at} />;
}
