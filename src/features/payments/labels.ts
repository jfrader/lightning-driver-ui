import type { PaymentState } from '../../api/types';

export const PAYMENT_STATE: Record<PaymentState, string> = {
  pending: 'Pending',
  succeeded: 'Succeeded',
  failed: 'Failed',
  unknown: 'Unknown',
};
