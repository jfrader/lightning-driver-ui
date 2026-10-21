import type { Invoice, InvoiceState } from '../../api/types';
import { isPast } from '../../lib/time';
import { labelsOf } from '../display/state-labels';
import type { StateLabel } from '../display/StateWord';

/** Invoice states (screens spec §1.2). The server's state is the only source of `Expired`. */
export const INVOICE_STATE: Record<InvoiceState, StateLabel> = {
  unpaid: { label: 'Unpaid', tone: 'info' },
  accepted: { label: 'Accepted, not settled', tone: 'info' },
  paid: { label: 'Paid', tone: 'quiet' },
  expired: { label: 'Expired', tone: 'quiet' },
  canceled: { label: 'Canceled', tone: 'quiet' },
  unknown: { label: 'State unknown', tone: 'warning' },
};

export const INVOICE_STATE_LABEL = labelsOf(INVOICE_STATE);

/**
 * What the expiry cell says (§1.4): `remaining` for an unpaid invoice that can still be paid,
 * `passed` for an unpaid one whose expiry is behind us (it stays `Unpaid`; the client never relabels
 * it `Expired`), `recorded` for any other state, `none` when the node did not report an expiry.
 */
export type InvoiceExpiry =
  | { kind: 'none' }
  | { kind: 'remaining'; at: string }
  | { kind: 'passed'; at: string }
  | { kind: 'recorded'; at: string };

export function invoiceExpiry(invoice: Invoice, now: number): InvoiceExpiry {
  const at = invoice.expires_at;
  if (at === null) return { kind: 'none' };
  if (invoice.state !== 'unpaid') return { kind: 'recorded', at };
  return isPast(at, now) ? { kind: 'passed', at } : { kind: 'remaining', at };
}

/** The invoice text may be copied to be paid only while it is unpaid, reported and not past its expiry. */
export function payableBolt11(invoice: Invoice, now: number): string | null {
  if (invoice.state !== 'unpaid' || invoice.bolt11 === null) return null;
  return invoiceExpiry(invoice, now).kind === 'passed' ? null : invoice.bolt11;
}
