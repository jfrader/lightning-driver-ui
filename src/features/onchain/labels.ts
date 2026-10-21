import type { Transaction } from '../../api/types';
import { formatInteger, parseWireDecimal } from '../../lib/money';
import type { StateLabel } from '../display/StateWord';

/** The direction carries the sign; amounts are shown without + or − (screens spec §2.2). */
export const DIRECTION: Record<Transaction['direction'], StateLabel> = {
  incoming: { label: 'Received', tone: 'quiet' },
  outgoing: { label: 'Sent', tone: 'quiet' },
  self: { label: 'To own wallet', tone: 'quiet' },
  unknown: { label: 'Direction unknown', tone: 'warning' },
};

/**
 * Confirmation word: `Unconfirmed` at 0, otherwise the count. There is no "final" or "safe"
 * threshold; the contract defines none. `null` when the node did not report a count.
 */
export function confirmationsLabel(confirmations: string | null): StateLabel | null {
  if (confirmations === null) return null;
  const count = parseWireDecimal(confirmations);
  if (count === 0n) return { label: 'Unconfirmed', tone: 'info' };
  return { label: `${formatInteger(count)} ${count === 1n ? 'confirmation' : 'confirmations'}`, tone: 'quiet' };
}

/** Block cell: the height, `Not in a block` for an unconfirmed transaction, or `null` when not reported. */
export function blockLabel(transaction: Transaction): string | null {
  if (transaction.block_height !== null) return formatInteger(parseWireDecimal(transaction.block_height));
  if (transaction.confirmations === '0') return 'Not in a block';
  return null;
}

export const OUTPUT_OWNER = { true: 'This wallet', false: 'External' } as const;
