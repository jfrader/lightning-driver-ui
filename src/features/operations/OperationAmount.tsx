import type { Operation } from '../../api/types';
import { Amount } from '../display/Amount';
import { NotReported } from '../display/NotReported';

/** The reviewed amount of an operation, in whichever unit its review carries; none for amountless kinds. */
export function OperationAmount({ operation }: { operation: Operation }) {
  const { amount_msat: msat, amount_sat: sat } = operation.review;
  if (msat !== null) return <Amount value={msat} unit="msat" />;
  if (sat !== null) return <Amount value={sat} unit="sat" />;
  return <NotReported>No amount</NotReported>;
}
