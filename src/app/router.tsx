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
import { isSessionLoss } from '../api/errors';
import { nodeQueryOptions } from '../api/node-queries';
import type { ChannelState, InvoiceState, OperationKind, OperationListState, PaymentState } from '../api/types';
import { RouteError } from '../components/RouteError';
import { LOGIN_NOTICE, type LoginNotice } from '../features/auth/login-state';
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
import { MorePage } from '../features/shell/MorePage';
import { SHELL_QUERY } from '../config';
import { safeRedirectPath } from '../lib/safe-redirect';
import { PAYMENT_SORT } from '../features/payments/payment-columns';
import { enumParam, hashParam, pagedSearch, pubkeyParam, resourceIdParam, sortSearch, stringParam, type PagedSearch, type SortSearch } from './search';

export interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({ component: Outlet });

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search: Record<string, unknown>): { redirect?: string; notice?: LoginNotice } => ({
    redirect: stringParam(search.redirect),
    notice: enumParam(search.notice, LOGIN_NOTICE),
  }),
  component: LoginPage,
});

/** Enrollment is a state of `/login` (P-2); the old route only forwards there. */
const enrollRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/enroll',
  beforeLoad: () => {
    throw redirect({ to: '/login', replace: true });
  },
});

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
      return null;
    });
    if (node) throw redirect({ to: '/nodes/$nodeId', params: { nodeId: node.id } });
    forgetRememberedNodeId();
  },
  component: NodeChooserPage,
});

const fleetRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/fleet',
  validateSearch: pagedSearch,
  component: FleetPage,
});

/** Phone only; the desktop shell carries the same controls, so a desktop visit opens the workspace. */
const moreRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/more',
  beforeLoad: () => {
    if (!window.matchMedia(SHELL_QUERY).matches) return;
    const nodeId = readRememberedNodeId();
    throw nodeId ? redirect({ to: '/nodes/$nodeId', params: { nodeId } }) : redirect({ to: '/fleet' });
  },
  component: MorePage,
});

const nodeRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/nodes/$nodeId',
  beforeLoad: ({ params }) => {
    if (!isNodeId(params.nodeId)) throw notFound();
  },
  loader: async ({ context, params }) => {
    const node = await context.queryClient.ensureQueryData(nodeQueryOptions(params.nodeId));
    if (node) rememberNodeId(node.id);
  },
  component: NodeLayout,
  notFoundComponent: NodeNotFound,
});

/** Workspace pages exist only for nodes the server configures now; history routes do not need it. */
const configuredNodeRoute = createRoute({
  getParentRoute: () => nodeRoute,
  id: '_configured',
  loader: async ({ context, params }) => {
    if (!(await context.queryClient.ensureQueryData(nodeQueryOptions(params.nodeId)))) throw notFound();
  },
  notFoundComponent: NodeNotFound,
});

const node = <TPath extends string>(path: TPath) => ({ getParentRoute: () => configuredNodeRoute, path });
const history = <TPath extends string>(path: TPath) => ({ getParentRoute: () => nodeRoute, path });

const nodeOverviewRoute = createRoute({ ...node('/'), component: NodeOverviewPage });
const invoicesRoute = createRoute({
  ...node('/invoices'),
  validateSearch: (search: Record<string, unknown>): PagedSearch & { status?: InvoiceState; selected?: string } => ({
    ...pagedSearch(search),
    status: enumParam(search.status, INVOICE_STATE),
    selected: hashParam(search.selected),
  }),
  component: InvoicesPage,
});
const receiveInvoiceRoute = createRoute({ ...node('/invoices/new'), component: ReceiveInvoicePage });
const paymentsRoute = createRoute({
  ...node('/payments'),
  validateSearch: (
    search: Record<string, unknown>,
  ): PagedSearch & SortSearch<keyof typeof PAYMENT_SORT> & { status?: PaymentState; selected?: string } => ({
    ...pagedSearch(search),
    ...sortSearch(search, PAYMENT_SORT),
    status: enumParam(search.status, PAYMENT_STATE),
    selected: hashParam(search.selected),
  }),
  component: PaymentsPage,
});
const payInvoiceRoute = createRoute({ ...node('/payments/new'), component: PayInvoicePage });
const peersRoute = createRoute({
  ...node('/peers'),
  validateSearch: (search: Record<string, unknown>): PagedSearch & { selected?: string } => ({
    ...pagedSearch(search),
    selected: pubkeyParam(search.selected),
  }),
  component: PeersPage,
});
const connectPeerRoute = createRoute({ ...node('/peers/new'), component: ConnectPeerPage });
const channelsRoute = createRoute({
  ...node('/channels'),
  validateSearch: (search: Record<string, unknown>): PagedSearch & { state?: ChannelState; selected?: string } => ({
    ...pagedSearch(search),
    state: enumParam(search.state, CHANNEL_STATE),
    selected: resourceIdParam(search.selected),
  }),
  component: ChannelsPage,
});
const openChannelRoute = createRoute({
  ...node('/channels/new'),
  validateSearch: (search: Record<string, unknown>): { peer?: string } => ({ peer: pubkeyParam(search.peer) }),
  component: OpenChannelPage,
});
const closeChannelRoute = createRoute({ ...node('/channels/$channelId/close'), component: CloseChannelPage });
const transactionsRoute = createRoute({
  ...node('/onchain'),
  validateSearch: (search: Record<string, unknown>): PagedSearch & { selected?: string } => ({
    ...pagedSearch(search),
    selected: hashParam(search.selected),
  }),
  component: TransactionsPage,
});
const receiveAddressRoute = createRoute({ ...node('/onchain/receive'), component: ReceiveAddressPage });
const sendOnchainRoute = createRoute({ ...node('/onchain/send'), component: SendOnchainPage });
const operationsRoute = createRoute({
  ...history('/operations'),
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
  ...history('/operations/$operationId'),
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
    moreRoute,
    nodeRoute.addChildren([
      configuredNodeRoute.addChildren([
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
      ]),
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
