import type { QueryClient } from '@tanstack/react-query';
import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  notFound,
  redirect,
  type RouterHistory,
} from '@tanstack/react-router';
import { errorCode, isSessionLoss } from '../api/errors';
import type { ChannelState, InvoiceState, OperationKind, OperationListState, PaymentState } from '../api/types';
import { RouteError } from '../components/RouteError';
import { nodeQueryOptions } from '../api/node-queries';
import { EnrollPage } from '../features/auth/EnrollPage';
import { LoginPage } from '../features/auth/LoginPage';
import { publicPolicyQueryOptions, sessionQueryOptions } from '../features/auth/queries';
import { CloseChannelPage } from '../features/channels/CloseChannelPage';
import { ChannelsPage } from '../features/channels/ChannelsPage';
import { CHANNEL_STATE } from '../features/channels/labels';
import { OpenChannelPage } from '../features/channels/OpenChannelPage';
import { InvoicesPage } from '../features/invoices/InvoicesPage';
import { INVOICE_STATE } from '../features/invoices/labels';
import { ReceiveInvoicePage } from '../features/invoices/ReceiveInvoicePage';
import { FleetPage } from '../features/nodes/FleetPage';
import { NodeChooserPage } from '../features/nodes/NodeChooserPage';
import { NodeLayout } from '../features/nodes/NodeLayout';
import { NodeNotFound } from '../features/nodes/NodeNotFound';
import { NodeOverviewPage } from '../features/nodes/NodeOverviewPage';
import { forgetRememberedNodeId, isNodeId, readRememberedNodeId, rememberNodeId } from '../features/nodes/remembered-node';
import { ReceiveAddressPage } from '../features/onchain/ReceiveAddressPage';
import { SendOnchainPage } from '../features/onchain/SendOnchainPage';
import { TransactionsPage } from '../features/onchain/TransactionsPage';
import { OPERATION_KIND, OPERATION_LIST_STATE } from '../features/operations/labels';
import { OperationPage } from '../features/operations/OperationPage';
import { OperationsPage } from '../features/operations/OperationsPage';
import { PAYMENT_STATE } from '../features/payments/labels';
import { PayInvoicePage } from '../features/payments/PayInvoicePage';
import { PaymentsPage } from '../features/payments/PaymentsPage';
import { ConnectPeerPage } from '../features/peers/ConnectPeerPage';
import { PeersPage } from '../features/peers/PeersPage';
import { AppShell } from '../features/shell/AppShell';
import { safeRedirectPath } from '../lib/safe-redirect';
import { enumParam, pagedSearch, stringParam, type PagedSearch } from './search';

export interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({ component: Outlet });

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: stringParam(search.redirect),
  }),
  component: LoginPage,
});

const enrollRoute = createRoute({ getParentRoute: () => rootRoute, path: '/enroll', component: EnrollPage });

const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_authed',
  beforeLoad: async ({ context, location }) => {
    try {
      await context.queryClient.ensureQueryData(sessionQueryOptions);
    } catch (error) {
      if (isSessionLoss(error)) {
        throw redirect({ to: '/login', search: { redirect: safeRedirectPath(location.href) } });
      }
      throw error;
    }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(publicPolicyQueryOptions),
  component: AppShell,
});

const landingRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/',
  validateSearch: pagedSearch,
  beforeLoad: async ({ context }) => {
    const nodeId = readRememberedNodeId();
    if (!nodeId) return;
    const node = await context.queryClient.ensureQueryData(nodeQueryOptions(nodeId)).catch((error: unknown) => {
      if (isSessionLoss(error)) throw error;
      forgetRememberedNodeId();
      return null;
    });
    if (node) throw redirect({ to: '/nodes/$nodeId', params: { nodeId: node.id } });
  },
  component: NodeChooserPage,
});

const fleetRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/fleet',
  validateSearch: pagedSearch,
  component: FleetPage,
});

const nodeRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/nodes/$nodeId',
  beforeLoad: ({ params }) => {
    if (!isNodeId(params.nodeId)) throw notFound();
  },
  loader: async ({ context, params }) => {
    const node = await context.queryClient.ensureQueryData(nodeQueryOptions(params.nodeId)).catch((error: unknown) => {
      if (errorCode(error) === 'not_found') throw notFound();
      throw error;
    });
    rememberNodeId(node.id);
  },
  component: NodeLayout,
  notFoundComponent: NodeNotFound,
});

const node = <TPath extends string>(path: TPath) => ({ getParentRoute: () => nodeRoute, path });

const nodeOverviewRoute = createRoute({ ...node('/'), component: NodeOverviewPage });
const invoicesRoute = createRoute({
  ...node('/invoices'),
  validateSearch: (search: Record<string, unknown>): PagedSearch & { status?: InvoiceState } => ({
    ...pagedSearch(search),
    status: enumParam(search.status, INVOICE_STATE),
  }),
  component: InvoicesPage,
});
const receiveInvoiceRoute = createRoute({ ...node('/invoices/new'), component: ReceiveInvoicePage });
const paymentsRoute = createRoute({
  ...node('/payments'),
  validateSearch: (search: Record<string, unknown>): PagedSearch & { status?: PaymentState } => ({
    ...pagedSearch(search),
    status: enumParam(search.status, PAYMENT_STATE),
  }),
  component: PaymentsPage,
});
const payInvoiceRoute = createRoute({ ...node('/payments/new'), component: PayInvoicePage });
const peersRoute = createRoute({ ...node('/peers'), validateSearch: pagedSearch, component: PeersPage });
const connectPeerRoute = createRoute({ ...node('/peers/new'), component: ConnectPeerPage });
const channelsRoute = createRoute({
  ...node('/channels'),
  validateSearch: (search: Record<string, unknown>): PagedSearch & { state?: ChannelState } => ({
    ...pagedSearch(search),
    state: enumParam(search.state, CHANNEL_STATE),
  }),
  component: ChannelsPage,
});
const openChannelRoute = createRoute({ ...node('/channels/new'), component: OpenChannelPage });
const closeChannelRoute = createRoute({ ...node('/channels/$channelId/close'), component: CloseChannelPage });
const transactionsRoute = createRoute({ ...node('/onchain'), validateSearch: pagedSearch, component: TransactionsPage });
const receiveAddressRoute = createRoute({ ...node('/onchain/receive'), component: ReceiveAddressPage });
const sendOnchainRoute = createRoute({ ...node('/onchain/send'), component: SendOnchainPage });
const operationsRoute = createRoute({
  ...node('/operations'),
  validateSearch: (
    search: Record<string, unknown>,
  ): PagedSearch & { state?: OperationListState; kind?: OperationKind } => ({
    ...pagedSearch(search),
    state: enumParam(search.state, OPERATION_LIST_STATE),
    kind: enumParam(search.kind, OPERATION_KIND),
  }),
  component: OperationsPage,
});
const operationRoute = createRoute({
  ...node('/operations/$operationId'),
  validateSearch: (search: Record<string, unknown>): { confirmation?: 'unanswered' } => ({
    confirmation: search.confirmation === 'unanswered' ? 'unanswered' : undefined,
  }),
  component: OperationPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  enrollRoute,
  authedRoute.addChildren([
    landingRoute,
    fleetRoute,
    nodeRoute.addChildren([
      nodeOverviewRoute,
      invoicesRoute,
      receiveInvoiceRoute,
      paymentsRoute,
      payInvoiceRoute,
      peersRoute,
      connectPeerRoute,
      channelsRoute,
      openChannelRoute,
      closeChannelRoute,
      transactionsRoute,
      receiveAddressRoute,
      sendOnchainRoute,
      operationsRoute,
      operationRoute,
    ]),
  ]),
]);

export function createAppRouter(queryClient: QueryClient, history?: RouterHistory) {
  return createRouter({
    routeTree,
    history,
    context: { queryClient },
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: RouteError,
    scrollRestoration: true,
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter;
  }
}
