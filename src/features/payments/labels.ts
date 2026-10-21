import type { PaymentState } from '../../api/types';
import { labelsOf } from '../display/state-labels';
import type { StateLabel } from '../display/StateWord';

export const PAYMENT_STATE: Record<PaymentState, StateLabel> = {
  pending: { label: 'Pending', tone: 'info' },
  succeeded: { label: 'Succeeded', tone: 'quiet' },
  failed: { label: 'Failed', tone: 'danger' },
  unknown: { label: 'Outcome unknown', tone: 'warning' },
};

/** Filter labels, from the same vocabulary. */
export const PAYMENT_STATE_LABEL = labelsOf(PAYMENT_STATE);
