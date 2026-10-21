import type { DecodedInvoice, NodeSummary } from '../../api/types';
import { formatClockTime } from '../../lib/time';
import { NETWORK_LABEL } from '../nodes/labels';

const LIGHTNING_PREFIX = /^lightning:/i;

/** Whitespace trimmed and a leading `lightning:` (any case) removed, as the server receives it. */
export function normalizeBolt11(text: string): string {
  return text.trim().replace(LIGHTNING_PREFIX, '').trim();
}

/** Why this decoded invoice cannot be paid from this node (copy deck §11.6), or `null`. */
export function payBlocker(invoice: DecodedInvoice, node: NodeSummary): string | null {
  if (invoice.expired) return `This invoice expired at ${formatClockTime(invoice.expires_at) ?? invoice.expires_at} UTC.`;
  if (invoice.network_matches_node === null) return 'The network of this node is not verified. Payments are disabled.';
  if (!invoice.network_matches_node) {
    return `This invoice is for ${NETWORK_LABEL[invoice.network]}. ${node.label} is on ${NETWORK_LABEL[node.network]}.`;
  }
  return null;
}
