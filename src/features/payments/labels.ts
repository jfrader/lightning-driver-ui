import type { PaymentState } from '../../api/types';

/** quiet: settled or terminal-normal; info: in progress; warning: needs a look; danger: failure. */
export type StateTone = 'quiet' | 'info' | 'warning' | 'danger';

export const PAYMENT_STATE: Record<PaymentState, { label: string; tone: StateTone }> = {
  pending: { label: 'Pending', tone: 'info' },
  succeeded: { label: 'Succeeded', tone: 'quiet' },
  failed: { label: 'Failed', tone: 'danger' },
  unknown: { label: 'Outcome unknown', tone: 'warning' },
};

/** Filter labels, from the same vocabulary. */
export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  pending: PAYMENT_STATE.pending.label,
  succeeded: PAYMENT_STATE.succeeded.label,
  failed: PAYMENT_STATE.failed.label,
  unknown: PAYMENT_STATE.unknown.label,
};
