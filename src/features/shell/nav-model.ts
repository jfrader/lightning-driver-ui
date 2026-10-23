import type { CapabilityKey, NodeSummary } from '../../api/types';
import { keysOf } from '../../lib/guards';

/** Node workspace destinations. `segment` is the path prefix after `/nodes/$nodeId`. */
export const NODE_DESTINATIONS = {
  overview: { label: 'Overview', to: '/nodes/$nodeId', segment: '' },
  payments: { label: 'Payments', to: '/nodes/$nodeId/payments', segment: 'payments' },
  invoices: { label: 'Invoices', to: '/nodes/$nodeId/invoices', segment: 'invoices' },
  onchain: { label: 'On-chain', to: '/nodes/$nodeId/onchain', segment: 'onchain' },
  channels: { label: 'Channels', to: '/nodes/$nodeId/channels', segment: 'channels' },
  peers: { label: 'Peers', to: '/nodes/$nodeId/peers', segment: 'peers' },
  operations: { label: 'Operations', to: '/nodes/$nodeId/operations', segment: 'operations' },
  watchtower: { label: 'Watchtower client', to: '/nodes/$nodeId/watchtower', segment: 'watchtower' },
  watchtowerServer: {
    label: 'Watchtower server',
    to: '/nodes/$nodeId/watchtower/server',
    segment: 'watchtower/server',
  },
} as const;

export type NodeDestination = keyof typeof NODE_DESTINATIONS;

export const ACTION_SURFACES: Record<CapabilityKey, NodeDestination> = {
  pay_invoice: 'payments',
  create_invoice: 'invoices',
  new_address: 'onchain',
  send_onchain: 'onchain',
  connect_peer: 'peers',
  disconnect_peer: 'peers',
  open_channel: 'channels',
  close_channel: 'channels',
};

export type PhoneTab = 'overview' | 'wallet' | 'channels' | 'peers' | 'more';

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
  { key: 'network', label: 'Network', items: ['channels', 'peers', 'watchtower', 'watchtowerServer'], tab: 'channels' },
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
  {
    label: 'Pay invoice…',
    to: '/nodes/$nodeId/payments/new',
    capability: 'pay_invoice',
    keywords: 'send lightning bolt11',
  },
  {
    label: 'Create invoice…',
    to: '/nodes/$nodeId/invoices/new',
    capability: 'create_invoice',
    keywords: 'receive request',
  },
  {
    label: 'New on-chain address…',
    to: '/nodes/$nodeId/onchain/receive',
    capability: 'new_address',
    keywords: 'receive deposit',
  },
  { label: 'Send on-chain…', to: '/nodes/$nodeId/onchain/send', capability: 'send_onchain', keywords: 'withdraw' },
  { label: 'Open channel…', to: '/nodes/$nodeId/channels/new', capability: 'open_channel', keywords: 'liquidity' },
  { label: 'Connect peer…', to: '/nodes/$nodeId/peers/new', capability: 'connect_peer', keywords: 'node' },
] as const satisfies readonly { label: string; to: string; capability: CapabilityKey; keywords: string }[];

export function surfacesFor(node: NodeSummary): NodeDestination[] {
  const available = node.read_availability;
  const reads: Record<NodeDestination, boolean> = {
    overview: node.kind === 'lightning' || available.bitcoin.enabled,
    payments: node.kind === 'lightning' && available.payments.enabled,
    invoices: node.kind === 'lightning' && available.invoices.enabled,
    onchain: node.kind === 'lightning' && available.onchain.enabled,
    channels: node.kind === 'lightning' && available.channels.enabled,
    peers: node.kind === 'bitcoin' ? available.bitcoin_peers.enabled : available.peers.enabled,
    operations: node.kind === 'lightning' && available.operations.enabled,
    watchtower: node.kind === 'lightning' && available.watchtower_client.enabled,
    watchtowerServer: node.kind === 'lightning' && available.watchtower_server.enabled,
  };
  return keysOf(NODE_DESTINATIONS).filter((key) => reads[key]);
}

export function groupsFor(node: NodeSummary): DestinationGroup[] {
  const surfaces = surfacesFor(node);
  return DESTINATION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((key) => surfaces.includes(key)),
    tab: node.kind === 'bitcoin' && group.key === 'network' ? ('peers' as const) : group.tab,
  })).filter((group) => group.items.length > 0);
}

export function phoneTabsFor(node: NodeSummary | null): typeof PHONE_TABS {
  if (!node) return PHONE_TABS;
  const groups = groupsFor(node);
  const tabs =
    node.kind === 'bitcoin'
      ? [PHONE_TABS[0], { key: 'peers' as const, label: 'Peers', destination: 'peers' as const }, PHONE_TABS[3]]
      : PHONE_TABS;
  return tabs
    .filter((tab) => tab.destination === null || groups.some((group) => group.tab === tab.key))
    .map((tab) => ({
      ...tab,
      destination:
        tab.destination === null ? null : (groups.find((group) => group.tab === tab.key)?.items[0] ?? tab.destination),
    }));
}

const NODE_PATH = /^\/nodes\/[^/]+(?:\/(.*))?/;

/** The destination a node path belongs to (a form belongs to its list), or `null` off the node workspace. */
export function destinationOf(pathname: string): NodeDestination | null {
  const match = NODE_PATH.exec(pathname);
  if (!match) return null;
  const segment = match[1] ?? '';
  return (
    keysOf(NODE_DESTINATIONS)
      .reverse()
      .find((key) => {
        const candidate = NODE_DESTINATIONS[key].segment;
        return segment === candidate || (candidate !== '' && segment.startsWith(`${candidate}/`));
      }) ?? null
  );
}

export function groupOf(destination: NodeDestination, node?: NodeSummary | null): DestinationGroup | undefined {
  return (node ? groupsFor(node) : DESTINATION_GROUPS).find((group) => group.items.includes(destination));
}
