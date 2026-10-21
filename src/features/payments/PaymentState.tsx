import type { PaymentState as State } from '../../api/types';
import { StateWord } from '../display/StateWord';
import { PAYMENT_STATE } from './labels';

export function PaymentState({ state }: { state: State }) {
  return <StateWord state={PAYMENT_STATE[state]} />;
}
