import type { QueryClient } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  notFound,
  redirect,
  type RouterHistory,
  type RouteComponent,
} from '@tanstack/react-router';
import { isSessionLoss } from '../api/errors';
import { nodeQueryOptions } from '../api/node-queries';
import type { ChannelState, InvoiceState, OperationKind, OperationListState, PaymentState } from '../api/types';
import { RouteError } from '../components/RouteError';
import { RoutePending } from '../components/RoutePending';
import { LOGIN_NOTICE, type LoginNotice } from '../features/auth/login-state';
import { LoginPage } from '../features/auth/LoginPage';
import { publicPolicyQueryOptions, sessionQueryOptions } from '../features/auth/queries';
import { CHANNEL_STATE } from '../features/channels/labels';
import { INVOICE_STATE } from '../features/invoices/labels';
import { NodeChooserPage } from '../features/nodes/NodeChooserPage';
import { NodeLayout } from '../features/nodes/NodeLayout';
import { NodeNotFound } from '../features/nodes/NodeNotFound';
import { NodeOverviewPage } from '../features/nodes/NodeOverviewPage';
import {
  forgetRememberedNodeId,
  isNodeId,
  readRememberedNodeId,
  rememberNodeId,
} from '../features/nodes/remembered-node';
import { OPERATION_KIND, OPERATION_LIST_STATE } from '../features/operations/labels';
import { PAYMENT_STATE } from '../features/payments/labels';
import { AppShell } from '../features/shell/AppShell';
import { OperationListLayout } from '../features/operations/OperationListLayout';
import {
  ChannelsPage,
  WatchtowerClientPage,
  WatchtowerServerPage,
  CloseChannelPage,
  ConnectPeerPage,
  FleetPage,
  InvoicesPage,
  MorePage,
  OpenChannelPage,
  OperationPage,
  OperationsPage,
  PayInvoicePage,
  PaymentsPage,
  OperationFormRoute,
  OperationReviewRoute,
  PeersPage,
  ReceiveAddressPage,
  ReceiveInvoicePage,
  SendOnchainPage,
  TransactionsPage,
} from './lazy-screens';
import { safeRedirectPath } from '../lib/safe-redirect';
import { PAYMENT_SORT } from '../features/payments/payment-columns';
import {
  booleanParam,
  booleanCodec,
  decimalParam,
  moneySearch,
  enumParam,
  hashParam,
  pagedSearch,
  pubkeyParam,
  resourceIdParam,
  sortSearch,
  stringParam,
  type PagedSearch,
  type SortSearch,
} from './search';

export interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({ component: Outlet });

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search: Record<string, unknown>): { redirect?: string; notice?: LoginNotice; enroll?: 1 } => ({
    redirect: stringParam(search.redirect),
    notice: enumParam(search.notice, LOGIN_NOTICE),
    enroll: booleanParam(search.enroll),
  }),
  component: LoginPage,
});

/** Enrollment is a state of `/login` (P-2); the old route only forwards there. */
const enrollRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/enroll',
  validateSearch: (search: Record<string, unknown>) => ({ redirect: stringParam(search.redirect) }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/login', search: { redirect: search.redirect, enroll: 1 }, replace: true });
  },
});

const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_authed',
  validateSearch: (search: Record<string, unknown>): { palette?: 1 } => ({ palette: booleanCodec.serialize(booleanCodec.parse(search.palette)) }),
  beforeLoad: async ({ context, location }) => {
    try {
      // The session and the public policy are independent reads: one round trip, not two.
      await Promise.all([
        context.queryClient.ensureQueryData(sessionQueryOptions),
        context.queryClient.ensureQueryData(publicPolicyQueryOptions),
      ]);
    } catch (error) {
      if (isSessionLoss(error)) {
        throw redirect({ to: '/login', search: { redirect: safeRedirectPath(location.href) } });
      }
      throw error;
    }
  },
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
  loader: ({ context }) => loadRememberedNode(context.queryClient),
  component: FleetPage,
});

const moreRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/more',
  loader: ({ context }) => loadRememberedNode(context.queryClient),
  component: MorePage,
});

async function loadRememberedNode(queryClient: QueryClient) {
  const nodeId = readRememberedNodeId();
  if (!nodeId) return;
  await queryClient.ensureQueryData(nodeQueryOptions(nodeId)).catch((error: unknown) => {
    if (isSessionLoss(error)) throw error;
  });
}

const nodeRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/nodes/$nodeId',
  validateSearch: moneySearch,
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

function operationList(Page: RouteComponent) {
  return Object.assign(() => <OperationListLayout><Page /></OperationListLayout>, { preload: Page.preload });
}

function operationForm(Page: RouteComponent, props: Omit<ComponentProps<typeof OperationFormRoute>, 'children'>) {
  return Object.assign(() => <OperationFormRoute {...props}><Page /></OperationFormRoute>, {
    preload: async () => { await Promise.all([OperationFormRoute.preload?.(), Page.preload?.()]); },
  });
}

function operationReview(list: ComponentProps<typeof OperationReviewRoute>['list']) {
  return Object.assign(() => <OperationReviewRoute list={list} />, { preload: OperationReviewRoute.preload });
}

const nodeOverviewRoute = createRoute({ ...node('/'), component: NodeOverviewPage });
const watchtowerClientRoute = createRoute({
  ...node('/watchtower'),
  validateSearch: (search: Record<string, unknown>): PagedSearch & { selected?: string } => ({
    ...pagedSearch(search),
    selected: pubkeyParam(search.selected),
  }),
  component: WatchtowerClientPage,
});
const watchtowerServerRoute = createRoute({ ...node('/watchtower/server'), component: WatchtowerServerPage });
const invoicesRoute = createRoute({
  ...node('/invoices'),
  validateSearch: (search: Record<string, unknown>): PagedSearch & { status?: InvoiceState; selected?: string } => ({
    ...pagedSearch(search),
    status: enumParam(search.status, INVOICE_STATE),
    selected: hashParam(search.selected),
  }),
  component: operationList(InvoicesPage),
});
const receiveInvoiceRoute = createRoute({ getParentRoute: () => invoicesRoute, path: '/new', component: operationForm(ReceiveInvoicePage, { list: 'invoices', kind: 'create_invoice' }) });
const invoiceReviewRoute = createRoute({ getParentRoute: () => invoicesRoute, path: '/review/$operationId', component: operationReview('invoices') });
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
  component: operationList(PaymentsPage),
});
const payInvoiceRoute = createRoute({ getParentRoute: () => paymentsRoute, path: '/new', component: operationForm(PayInvoicePage, { list: 'payments', kind: 'pay_invoice' }) });
const payReviewRoute = createRoute({ getParentRoute: () => paymentsRoute, path: '/review/$operationId', component: operationReview('payments') });
const peersRoute = createRoute({
  ...node('/peers'),
  validateSearch: (search: Record<string, unknown>): PagedSearch & { selected?: string } => ({
    ...pagedSearch(search),
    selected: pubkeyParam(search.selected) ?? decimalParam(search.selected),
  }),
  component: operationList(PeersPage),
});
const connectPeerRoute = createRoute({ getParentRoute: () => peersRoute, path: '/new', component: operationForm(ConnectPeerPage, { list: 'peers', kind: 'connect_peer' }) });
const peerReviewRoute = createRoute({ getParentRoute: () => peersRoute, path: '/review/$operationId', component: operationReview('peers') });
const channelsRoute = createRoute({
  ...node('/channels'),
  validateSearch: (search: Record<string, unknown>): PagedSearch & { state?: ChannelState; selected?: string } => ({
    ...pagedSearch(search),
    state: enumParam(search.state, CHANNEL_STATE),
    selected: resourceIdParam(search.selected),
  }),
  component: operationList(ChannelsPage),
});
const openChannelRoute = createRoute({
  getParentRoute: () => channelsRoute, path: '/new',
  validateSearch: (search: Record<string, unknown>): { peer?: string } => ({ peer: pubkeyParam(search.peer) }),
  component: operationForm(OpenChannelPage, { list: 'channels', kind: 'open_channel' }),
});
const closeChannelRoute = createRoute({ getParentRoute: () => channelsRoute, path: '/$channelId/close', component: operationForm(CloseChannelPage, { list: 'channels', kind: 'close_channel' }) });
const channelReviewRoute = createRoute({ getParentRoute: () => channelsRoute, path: '/review/$operationId', component: operationReview('channels') });
const transactionsRoute = createRoute({
  ...node('/onchain'),
  validateSearch: (search: Record<string, unknown>): PagedSearch & { selected?: string } => ({
    ...pagedSearch(search),
    selected: hashParam(search.selected),
  }),
  component: operationList(TransactionsPage),
});
const receiveAddressRoute = createRoute({ getParentRoute: () => transactionsRoute, path: '/receive', component: operationForm(ReceiveAddressPage, { list: 'onchain', kind: 'new_address' }) });
const sendOnchainRoute = createRoute({ getParentRoute: () => transactionsRoute, path: '/send', component: operationForm(SendOnchainPage, { list: 'onchain', kind: 'send_onchain' }) });
const onchainReviewRoute = createRoute({ getParentRoute: () => transactionsRoute, path: '/review/$operationId', component: operationReview('onchain') });
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
        watchtowerClientRoute,
        watchtowerServerRoute,
        invoicesRoute.addChildren([receiveInvoiceRoute, invoiceReviewRoute]),
        paymentsRoute.addChildren([payInvoiceRoute, payReviewRoute]),
        peersRoute.addChildren([connectPeerRoute, peerReviewRoute]),
        channelsRoute.addChildren([openChannelRoute, closeChannelRoute, channelReviewRoute]),
        transactionsRoute.addChildren([receiveAddressRoute, sendOnchainRoute, onchainReviewRoute]),
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
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: RouteError,
    defaultPendingComponent: RoutePending,
    scrollRestoration: true,
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter;
  }
}
