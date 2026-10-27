import type { PillTone } from '@jfrader/ui';
import type {
  AuthMethod,
  Operation,
  OperationKind,
  OperationListState,
  OperationStage,
  OperationState,
} from '../../api/types';

export const OPERATION_KIND: Record<OperationKind, string> = {
  create_invoice: 'Create invoice',
  pay_invoice: 'Pay invoice',
  connect_peer: 'Connect peer',
  disconnect_peer: 'Disconnect peer',
  open_channel: 'Open channel',
  close_channel: 'Close channel',
  new_address: 'New address',
  send_onchain: 'Send on-chain',
};

export const NODE_OBSERVED_KINDS: Record<OperationKind, boolean> = {
  create_invoice: false,
  pay_invoice: true,
  connect_peer: true,
  disconnect_peer: true,
  open_channel: true,
  close_channel: true,
  new_address: false,
  send_onchain: true,
};

export const OPERATION_STATE: Record<OperationState, { label: string; tone: PillTone }> = {
  awaiting_confirmation: { label: 'Awaiting confirmation', tone: 'neutral' },
  dispatching: { label: 'Sending to node', tone: 'accent' },
  pending: { label: 'Pending', tone: 'accent' },
  unknown: { label: 'Outcome unknown', tone: 'warning' },
  succeeded: { label: 'Succeeded', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  expired: { label: 'Review expired', tone: 'neutral' },
};

export const OPERATION_LIST_STATE: Record<OperationListState, string> = {
  nonterminal: 'Unresolved',
  awaiting_confirmation: OPERATION_STATE.awaiting_confirmation.label,
  dispatching: OPERATION_STATE.dispatching.label,
  pending: OPERATION_STATE.pending.label,
  unknown: OPERATION_STATE.unknown.label,
  succeeded: OPERATION_STATE.succeeded.label,
  failed: OPERATION_STATE.failed.label,
  expired: OPERATION_STATE.expired.label,
};

export const OPERATION_STAGE: Record<OperationStage, string> = {
  not_dispatched: 'Not sent',
  submitted: 'Submitted to node',
  reconciling: 'Checking with node',
  broadcast: 'Broadcast, not confirmed',
  confirmed: 'Confirmed on chain',
  settled: 'Settled',
  channel_active: 'Channel active',
  channel_closed: 'Channel closed',
  completed: 'Completed',
};

/** Operation screen title: `{noun} operation`. */
export const OPERATION_NOUN: Record<OperationKind, string> = {
  create_invoice: 'Invoice',
  pay_invoice: 'Payment',
  connect_peer: 'Connect peer',
  disconnect_peer: 'Disconnect peer',
  open_channel: 'Channel open',
  close_channel: 'Channel close',
  new_address: 'Address',
  send_onchain: 'On-chain send',
};

export const AUTHORIZATION_STATUS: Record<Operation['authorization']['status'], string> = {
  not_required: 'Not required',
  required: 'Authorization required',
  authorized: 'Authorized, not yet used',
  consumed: 'Authorized and used',
};

const SUCCESS_LABEL: Record<OperationKind, string> = {
  create_invoice: 'Invoice created',
  pay_invoice: 'Paid',
  connect_peer: 'Peer connected',
  disconnect_peer: 'Peer disconnected',
  open_channel: 'Channel active',
  close_channel: 'Channel closed',
  new_address: 'Address created',
  send_onchain: 'Broadcast',
};

const CONFIRM_VERB: Record<OperationKind, string> = {
  create_invoice: 'Create invoice',
  pay_invoice: 'Pay',
  connect_peer: 'Connect',
  disconnect_peer: 'Disconnect',
  open_channel: 'Open channel',
  close_channel: 'Close channel',
  new_address: 'New address',
  send_onchain: 'Send',
};

const STEP_UP_NAME: Record<AuthMethod, string> = { passkey: 'passkey', nostr: 'Nostr' };

/** A sensitive review's action names the step-up it starts: "Pay with passkey", "Pay with Nostr". */
export function confirmLabel(operation: Operation, method: AuthMethod): string {
  const verb = CONFIRM_VERB[operation.request.kind];
  return operation.review.sensitive ? `${verb} with ${STEP_UP_NAME[method]}` : verb;
}

/** What is known about an unresolved operation, and what not to do (copy deck §11.4). */
export const UNRESOLVED_SENTENCE: Record<OperationKind, { unknown: string; pending: string }> = {
  pay_invoice: {
    unknown: 'The node may have sent this payment. Do not pay this invoice again until the outcome resolves.',
    pending: 'In flight. The node has not reported a final outcome.',
  },
  send_onchain: {
    unknown: 'The node may have broadcast this transaction. Do not send these funds again until the outcome resolves.',
    pending: 'Sent to the node. Not yet reported as broadcast.',
  },
  open_channel: {
    unknown: 'The node may have started funding this channel. Do not open another channel with this peer until the outcome resolves.',
    pending: 'Funding started. Channel not active yet.',
  },
  close_channel: {
    unknown: 'The node may have started closing this channel. Do not close it again until the outcome resolves.',
    pending: 'Closing. Channel not closed yet.',
  },
  create_invoice: {
    unknown: 'The node may have created this invoice. Do not create another invoice for this request until the outcome resolves.',
    pending: 'Sent to the node. No invoice reported yet.',
  },
  new_address: {
    unknown: 'The node may have created an address. No address is shown until the node reports it.',
    pending: 'Sent to the node. No address reported yet.',
  },
  connect_peer: {
    unknown: 'The node may have connected to this peer. Do not connect again until the outcome resolves.',
    pending: 'Sent to the node.',
  },
  disconnect_peer: {
    unknown: 'The node may have disconnected this peer. Do not disconnect again until the outcome resolves.',
    pending: 'Sent to the node.',
  },
};

const IN_FLIGHT: ReadonlySet<OperationState> = new Set(['dispatching', 'pending', 'unknown']);

/** Possibly sent to the node and not final: only status reads may follow. */
export function isInFlight(state: OperationState): boolean {
  return IN_FLIGHT.has(state);
}

/** Headline for an operation: success wording depends on the kind and evidenced stage. */
export function outcomeLabel(operation: Operation): { label: string; tone: PillTone } {
  if (operation.state !== 'succeeded') return OPERATION_STATE[operation.state];
  if (operation.request.kind === 'send_onchain' && operation.stage === 'confirmed') {
    return { label: OPERATION_STAGE.confirmed, tone: 'success' };
  }
  const label = SUCCESS_LABEL[operation.request.kind];
  return { label: operation.stage === 'broadcast' ? OPERATION_STAGE.broadcast : label, tone: 'success' };
}
