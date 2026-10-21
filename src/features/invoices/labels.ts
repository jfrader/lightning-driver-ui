import type { InvoiceState } from '../../api/types';

export const INVOICE_STATE: Record<InvoiceState, string> = {
  unpaid: 'Unpaid',
  accepted: 'Accepted',
  paid: 'Paid',
  expired: 'Expired',
  canceled: 'Canceled',
  unknown: 'Unknown',
};
