import type { PillTone } from '@jfrader/ui';
import type { CapabilityKey, CapabilityReason, Network, NodeStatus, NodeSummary } from '../../api/types';

export const NODE_STATUS: Record<NodeStatus['status'], { label: string; tone: PillTone }> = {
  connecting: { label: 'Connecting', tone: 'neutral' },
  online: { label: 'Online', tone: 'success' },
  offline: { label: 'Offline', tone: 'danger' },
  auth_error: { label: 'Credentials rejected', tone: 'danger' },
  config_error: { label: 'Configuration error', tone: 'danger' },
  unsupported: { label: 'Unsupported node version', tone: 'warning' },
  identity_mismatch: { label: 'Identity mismatch', tone: 'danger' },
};

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

export function syncLabel(synced: boolean | null): string {
  if (synced === null) return 'Not reported';
  return synced ? 'Synced' : 'Syncing';
}
