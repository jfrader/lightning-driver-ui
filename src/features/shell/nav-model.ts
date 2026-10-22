import type { CapabilityKey } from '../../api/types';
import { keysOf } from '../../lib/guards';

/** Node workspace destinations. `segment` is the first path segment after `/nodes/$nodeId`. */
export const NODE_DESTINATIONS = {
  overview: { label: 'Overview', to: '/nodes/$nodeId', segment: '' },
  payments: { label: 'Payments', to: '/nodes/$nodeId/payments', segment: 'payments' },
  invoices: { label: 'Invoices', to: '/nodes/$nodeId/invoices', segment: 'invoices' },
  onchain: { label: 'On-chain', to: '/nodes/$nodeId/onchain', segment: 'onchain' },
  channels: { label: 'Channels', to: '/nodes/$nodeId/channels', segment: 'channels' },
  peers: { label: 'Peers', to: '/nodes/$nodeId/peers', segment: 'peers' },
  operations: { label: 'Operations', to: '/nodes/$nodeId/operations', segment: 'operations' },
} as const;

export type NodeDestination = keyof typeof NODE_DESTINATIONS;

export type PhoneTab = 'overview' | 'wallet' | 'channels' | 'more';

export interface DestinationGroup {
  key: string;
  label?: string;
  items: readonly NodeDestination[];
  /** Phone tab that owns this group's destinations. */
  tab: PhoneTab;
}

export const GLOBAL_DESTINATIONS = {
  fleet: { label: 'Fleet', to: '/fleet', keywords: 'nodes' },
  more: { label: 'More', to: '/more', keywords: 'sign-in methods linked keys session theme unit' },
} as const;

/** Sidebar groups in order; global destinations follow them. */
export const DESTINATION_GROUPS: readonly DestinationGroup[] = [
  { key: 'node', items: ['overview'], tab: 'overview' },
  { key: 'wallet', label: 'Wallet', items: ['payments', 'invoices', 'onchain'], tab: 'wallet' },
  { key: 'network', label: 'Network', items: ['channels', 'peers'], tab: 'channels' },
  { key: 'records', items: ['operations'], tab: 'overview' },
];

export const PHONE_TABS: readonly { key: PhoneTab; label: string; destination: NodeDestination | null }[] = [
  { key: 'overview', label: 'Overview', destination: 'overview' },
  { key: 'wallet', label: 'Wallet', destination: 'payments' },
  { key: 'channels', label: 'Channels', destination: 'channels' },
  { key: 'more', label: 'More', destination: null },
];

/** Palette form openings. Opening a form never creates, authorizes or confirms anything. */
export const FORM_DESTINATIONS = [
  { label: 'Pay invoice…', to: '/nodes/$nodeId/payments/new', capability: 'pay_invoice', keywords: 'send lightning bolt11' },
  { label: 'Create invoice…', to: '/nodes/$nodeId/invoices/new', capability: 'create_invoice', keywords: 'receive request' },
  { label: 'New on-chain address…', to: '/nodes/$nodeId/onchain/receive', capability: 'new_address', keywords: 'receive deposit' },
  { label: 'Send on-chain…', to: '/nodes/$nodeId/onchain/send', capability: 'send_onchain', keywords: 'withdraw' },
  { label: 'Open channel…', to: '/nodes/$nodeId/channels/new', capability: 'open_channel', keywords: 'liquidity' },
  { label: 'Connect peer…', to: '/nodes/$nodeId/peers/new', capability: 'connect_peer', keywords: 'node' },
] as const satisfies readonly { label: string; to: string; capability: CapabilityKey; keywords: string }[];

const NODE_PATH = /^\/nodes\/[^/]+(?:\/([^/]+))?/;

/** The destination a node path belongs to (a form belongs to its list), or `null` off the node workspace. */
export function destinationOf(pathname: string): NodeDestination | null {
  const match = NODE_PATH.exec(pathname);
  if (!match) return null;
  const segment = match[1] ?? '';
  return keysOf(NODE_DESTINATIONS).find((key) => NODE_DESTINATIONS[key].segment === segment) ?? null;
}

export function groupOf(destination: NodeDestination): DestinationGroup | undefined {
  return DESTINATION_GROUPS.find((group) => group.items.includes(destination));
}
