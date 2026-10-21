import type { CapabilityKey, CapabilityReason, Network, NodeStatus, NodeSummary, PublicPolicy } from '../../api/types';
import { keysOf } from '../../lib/guards';
import type { StateLabel } from '../display/StateWord';

/** Node status words (screens spec §4.2). */
export const NODE_STATUS: Record<NodeStatus['status'], StateLabel> = {
  online: { label: 'Online', tone: 'quiet' },
  connecting: { label: 'Connecting', tone: 'info' },
  offline: { label: 'Offline', tone: 'warning' },
  auth_error: { label: 'Credentials rejected', tone: 'danger' },
  config_error: { label: 'Configuration error', tone: 'danger' },
  unsupported: { label: 'Unsupported node', tone: 'danger' },
  identity_mismatch: { label: 'Identity mismatch', tone: 'danger' },
};

/** Short reason words for a whole node's actions (Fleet row summary, §7.0.4). */
export const CAPABILITY_REASON_WORD: Record<CapabilityReason, string> = {
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
  signet: 'Signet',
  regtest: 'Regtest',
  unknown: 'Unknown network',
};

export const BACKEND_LABEL: Record<NodeSummary['backend'], string> = {
  lnd_grpc: 'LND gRPC',
  lnd_rest: 'LND REST',
  cln_rest: 'Core Lightning REST',
};

export const CAPABILITY_REASON: Record<CapabilityReason, string> = {
  read_only: 'This node is read-only.',
  unsupported: 'This node backend does not support this action.',
  node_offline: 'The node is offline.',
  unverified: 'The node identity is not verified.',
  not_configured: 'Limits for this action are not configured on the server.',
  permission_denied: 'The node credentials do not allow this action.',
  syncing: 'The node is still syncing.',
};

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
    node.read_only ? 'read-only' : null,
    node.status.status === 'online' ? null : NODE_STATUS[node.status.status].label.toLowerCase(),
  ];
  return [node.label, NETWORK_LABEL[node.network], ...flags.filter((flag) => flag !== null)].join(' · ');
}

export const REAUTH_LABEL: Record<PublicPolicy['reauth']['mode'], string> = {
  every_operation: 'Passkey for every payment',
  recent: 'Passkey if not used recently',
};

export function syncLabel(synced: boolean | null): string {
  if (synced === null) return 'Not reported';
  return synced ? 'Synced' : 'Syncing';
}
