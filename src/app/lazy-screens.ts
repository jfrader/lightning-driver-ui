import { lazyRouteComponent } from '@tanstack/react-router';

/**
 * Screens loaded on first visit (implementation spec §12). The entry keeps only the shell and the
 * landing screens: node chooser, node overview, and sign-in. Sign-in stays in the entry because a
 * 401 must replace the workbench at once (§8.1); while a lazy chunk loaded, the old screen stayed
 * mounted and its observers re-read the session after it ended. Every other screen is its own
 * chunk, and code shared between screens lands in shared chunks, never in per-screen copies.
 */
export const FleetPage = lazyRouteComponent(() => import('../features/nodes/FleetPage'), 'FleetPage');
export const MorePage = lazyRouteComponent(() => import('../features/shell/MorePage'), 'MorePage');

export const PaymentsPage = lazyRouteComponent(() => import('../features/payments/PaymentsPage'), 'PaymentsPage');
export const PayInvoicePage = lazyRouteComponent(() => import('../features/payments/PayInvoicePage'), 'PayInvoicePage');
export const InvoicesPage = lazyRouteComponent(() => import('../features/invoices/InvoicesPage'), 'InvoicesPage');
export const ReceiveInvoicePage = lazyRouteComponent(
  () => import('../features/invoices/ReceiveInvoicePage'),
  'ReceiveInvoicePage',
);
export const TransactionsPage = lazyRouteComponent(() => import('../features/onchain/TransactionsPage'), 'TransactionsPage');
export const ReceiveAddressPage = lazyRouteComponent(
  () => import('../features/onchain/ReceiveAddressPage'),
  'ReceiveAddressPage',
);
export const SendOnchainPage = lazyRouteComponent(() => import('../features/onchain/SendOnchainPage'), 'SendOnchainPage');

export const ChannelsPage = lazyRouteComponent(() => import('../features/channels/ChannelsPage'), 'ChannelsPage');
export const OpenChannelPage = lazyRouteComponent(() => import('../features/channels/OpenChannelPage'), 'OpenChannelPage');
export const CloseChannelPage = lazyRouteComponent(() => import('../features/channels/CloseChannelPage'), 'CloseChannelPage');
export const PeersPage = lazyRouteComponent(() => import('../features/peers/PeersPage'), 'PeersPage');
export const ConnectPeerPage = lazyRouteComponent(() => import('../features/peers/ConnectPeerPage'), 'ConnectPeerPage');

export const OperationsPage = lazyRouteComponent(() => import('../features/operations/OperationsPage'), 'OperationsPage');
export const OperationPage = lazyRouteComponent(() => import('../features/operations/OperationPage'), 'OperationPage');
