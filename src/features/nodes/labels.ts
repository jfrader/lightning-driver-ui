import type {
  AuthMethod,
  CapabilityKey,
  CapabilityReason,
  Network,
  NodeStatus,
  NodeSummary,
  PublicPolicy,
} from '../../api/types';
import { keysOf } from '../../lib/guards';
import type { StateLabel } from '../display/StateWord';

/** Node status words (screens spec §4.2). */
export const NODE_STATUS: Record<NodeStatus['status'], StateLabel> = {
  online: { label: 'Online', tone: 'success' },
  connecting: { label: 'Connecting', tone: 'info' },
  offline: { label: 'Offline', tone: 'warning' },
  auth_error: { label: 'Credentials rejected', tone: 'danger' },
  config_error: { label: 'Configuration error', tone: 'danger' },
  unsupported: { label: 'Unsupported node', tone: 'danger' },
  identity_mismatch: { label: 'Identity mismatch', tone: 'danger' },
};

/** Short reason words for a whole node's actions (Fleet row summary, §7.0.4). */
export const CAPABILITY_REASON_WORD: Record<CapabilityReason, string> = {
  monitor_only: 'Monitor only',
  read_only: 'Read-only',
  unsupported: 'Unsupported',
  node_offline: 'Offline',
  unverified: 'Unverified',
  not_configured: 'Not configured',
  permission_denied: 'No permission',
  syncing: 'Syncing',
};

/**
 * One line for what a node allows (§4.3): all actions, a single shared reason, or a mixed state.
 * Built only from `capabilities`; limits come from the node's policy, not the fleet list.
 */
export function capabilitySummary(node: NodeSummary): string {
  if (node.kind === 'bitcoin') return 'None';
  const states = keysOf(node.capabilities).map((key) => node.capabilities[key]);
  if (states.every((state) => state.enabled)) return 'All actions';
  const reasons = new Set(states.map((state) => (state.enabled ? null : state.reason)));
  const [only] = reasons;
  if (reasons.size === 1 && only) return CAPABILITY_REASON_WORD[only];
  return 'Some actions unavailable';
}

export const NETWORK_LABEL: Record<Network, string> = {
  mainnet: 'Mainnet',
  testnet: 'Testnet',
  testnet4: 'Testnet4',
  signet: 'Signet',
  regtest: 'Regtest',
  unknown: 'Unknown network',
};

export const BACKEND_LABEL: Record<NodeSummary['backend'], string> = {
  bitcoin_rpc: 'Bitcoin Core',
  lnd_grpc: 'LND gRPC',
  lnd_rest: 'LND REST',
  cln_rest: 'Core Lightning REST',
};

/** Why an action is unavailable, as one sentence beside the control or in place of the form (§7.0.4). */
export function capabilityReasonText(reason: CapabilityReason, node: Pick<NodeSummary, 'backend'>): string {
  switch (reason) {
    case 'monitor_only':
      return 'This node is monitor only.';
    case 'read_only':
      return 'This node is read-only.';
    case 'unsupported':
      return `${BACKEND_LABEL[node.backend]} does not support this action in Lightning Driver.`;
    case 'node_offline':
      return 'The node is offline.';
    case 'unverified':
      return 'The node identity is not verified.';
    case 'not_configured':
      return 'This action is not configured on the server.';
    case 'permission_denied':
      return 'The node credentials do not allow this action.';
    case 'syncing':
      return 'The node is syncing.';
  }
}

/**
 * The reason an action cannot start on this node now, or `null` when it can. An unknown network or
 * an unverified identity blocks every action as `unverified`, whatever the capability says.
 */
export function capabilityBlock(node: NodeSummary, capability: CapabilityKey): CapabilityReason | null {
  if (node.kind === 'bitcoin') return 'monitor_only';
  if (node.read_only) return 'read_only';
  if (node.network === 'unknown' || node.identity_pubkey === null) return 'unverified';
  const state = node.capabilities[capability];
  return state.enabled ? null : state.reason;
}

export const CAPABILITY_LABEL: Record<CapabilityKey, string> = {
  create_invoice: 'Create invoice',
  pay_invoice: 'Pay invoice',
  connect_peer: 'Connect peer',
  disconnect_peer: 'Disconnect peer',
  open_channel: 'Open channel',
  close_channel: 'Close channel',
  new_address: 'New address',
  send_onchain: 'Send on-chain',
};

/**
 * Plain-string node label for choosers (`LND lab · Regtest · read-only`): the installed Select
 * renders an option's flattened text in its trigger, so flags must be text, not markup.
 */
export function nodeChoiceLabel(node: NodeSummary): string {
  const flags = [
    node.kind === 'bitcoin' ? 'Bitcoin Core · Monitor only' : node.read_only ? 'read-only' : null,
    node.status.status === 'online' ? null : NODE_STATUS[node.status.status].label.toLowerCase(),
  ];
  return [node.label, NETWORK_LABEL[node.network], ...flags.filter((flag) => flag !== null)].join(' · ');
}

export function accessLabel(node: NodeSummary): string {
  return node.kind === 'bitcoin' ? 'Monitor only' : node.read_only ? 'Read-only' : 'Writable';
}

/** The confirmation policy as the session meets it: with its passkey or its Nostr key. */
export const REAUTH_LABEL: Record<AuthMethod, Record<PublicPolicy['reauth']['mode'], string>> = {
  passkey: {
    every_operation: 'Passkey for every payment',
    recent: 'Passkey if not used recently',
  },
  nostr: {
    every_operation: 'Nostr signature for every payment',
    recent: 'Nostr signature if not used recently',
  },
};

export function syncLabel(synced: boolean | null): string {
  if (synced === null) return 'Not reported';
  return synced ? 'Synced' : 'Syncing';
}
