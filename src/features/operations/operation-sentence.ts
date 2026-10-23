import type { ErrorCode, Operation, OperationKind } from '../../api/types';
import { formatInteger, parseWireDecimal } from '../../lib/money';
import { CLOSE_TYPE } from '../channels/labels';
import { isInFlight, UNRESOLVED_SENTENCE } from './labels';

const RECONCILIATION_SENTENCE: Record<NonNullable<NonNullable<Operation['reconciliation']>['last_outcome']>, string | null> = {
  in_flight: null,
  positive: null,
  rejected: null,
  withheld: 'The node could not be reached.',
  not_found: 'The node reported no result yet.',
  invalid: 'The node returned an unusable answer.',
  pruned: 'The node reported no result yet.',
  conflict: 'The node returned an unusable answer.',
  paid_elsewhere: null,
};

export function reconciliationSentence(operation: Pick<Operation, 'state' | 'reconciliation'>): string | null {
  if (!isInFlight(operation.state) || !operation.reconciliation) return null;
  const { exhausted, last_outcome } = operation.reconciliation;
  if (exhausted) return 'No further automatic checks.';
  return last_outcome === null ? null : RECONCILIATION_SENTENCE[last_outcome];
}

/** Error code → sentence (copy deck §11.5); codes not listed fall back to the server message. */
const ERROR_SENTENCE: Partial<Record<ErrorCode, string>> = {
  insufficient_funds: 'Insufficient funds.',
  no_route: 'No route found.',
  fee_limit_exceeded: 'Every route found costs more than the fee cap.',
  peer_unavailable: 'The peer is unavailable.',
  upstream_rejected: 'The node rejected the request.',
  invoice_expired: 'The invoice expired.',
  already_paid: 'This node already paid this invoice.',
  resource_busy: 'Another operation on this node is unresolved.',
};

const FAILED_PREFIX: Record<OperationKind, string> = {
  pay_invoice: 'Not paid.',
  send_onchain: 'Not sent.',
  open_channel: 'Channel not opened.',
  close_channel: 'Channel not closed.',
  create_invoice: 'No invoice created.',
  new_address: 'No address created.',
  connect_peer: 'Not connected.',
  disconnect_peer: 'Not disconnected.',
};

const SUCCEEDED: Record<OperationKind, string> = {
  pay_invoice: 'Paid.',
  send_onchain: 'Broadcast by the node. Not yet in a block.',
  open_channel: 'Channel active.',
  close_channel: 'Channel closed.',
  create_invoice: 'Invoice created.',
  new_address: 'Address created.',
  connect_peer: 'Connected.',
  disconnect_peer: 'Disconnected.',
};

const EXPIRED = 'Review expired before confirmation. Nothing was sent.';

function succeeded(operation: Operation): string {
  const { result } = operation;
  if (result?.kind === 'send_onchain' && operation.stage === 'confirmed' && result.confirmations !== null) {
    return `In a block. ${formatInteger(parseWireDecimal(result.confirmations))} confirmations.`;
  }
  if (result?.kind === 'close_channel') return `Channel closed. Close type: ${CLOSE_TYPE[result.close_type]}.`;
  if (result?.kind === 'connect_peer' && !result.connected) return 'The node reports this peer as not connected.';
  return SUCCEEDED[operation.request.kind];
}

function failed(operation: Operation): string {
  const { error } = operation;
  if (operation.request.kind === 'close_channel' && error?.code === 'unexpected_unilateral_close') {
    return 'The channel closed unilaterally. A cooperative close was requested.';
  }
  const reason = error ? (ERROR_SENTENCE[error.code] ?? error.message) : null;
  return [FAILED_PREFIX[operation.request.kind], reason].filter(Boolean).join(' ');
}

/**
 * What is known about an operation in its current state, and what not to do (copy deck §11.4).
 * `null` for an awaiting review, which the review screen itself explains.
 */
export function operationSentence(operation: Operation): string | null {
  switch (operation.state) {
    case 'awaiting_confirmation':
      return null;
    case 'dispatching':
    case 'pending':
      return UNRESOLVED_SENTENCE[operation.request.kind].pending;
    case 'unknown':
      return UNRESOLVED_SENTENCE[operation.request.kind].unknown;
    case 'succeeded':
      return succeeded(operation);
    case 'failed':
      return failed(operation);
    case 'expired':
      return EXPIRED;
  }
}
