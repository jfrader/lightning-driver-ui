import type { Page, Route } from '@playwright/test';
import examples from '../../contract/examples.v1.json' with { type: 'json' };

type Fixtures = (typeof examples)['fixtures'];
const fixture = <T extends keyof Fixtures>(name: T): Fixtures[T]['value'] =>
  structuredClone(examples.fixtures[name].value);

/** Inside the fixtures' review window (reviews expire 12:05Z). */
export const FIXTURE_NOW = new Date('2026-10-21T12:01:00Z');

const OPERATION_KINDS = [
  'create_invoice',
  'pay_invoice',
  'connect_peer',
  'disconnect_peer',
  'open_channel',
  'close_channel',
  'new_address',
  'send_onchain',
] as const;
type Kind = (typeof OPERATION_KINDS)[number];

function isKind(value: unknown): value is Kind {
  return typeof value === 'string' && OPERATION_KINDS.some((kind) => kind === value);
}

export function operation(kind: Kind, state = 'awaiting_confirmation', stage = 'not_dispatched', withResult = false) {
  const review = fixture(`${kind}_review`);
  return {
    ...fixture('operation_review'),
    id: review.operation_id,
    node_id: review.node.node_id,
    request: fixture(`${kind}_request`),
    review,
    state,
    stage,
    authorization: { status: review.sensitive ? 'required' : 'not_required', mode: 'every_operation', expires_at: null },
    result: withResult ? fixture(`${kind}_result`) : null,
  };
}

/** An unresolved payment of the synthetic node, with its own id so it never shadows a fresh review. */
export const UNRESOLVED_OPERATION_ID = '00000000-0000-4000-8000-000000000801';

export function unresolvedOperation() {
  const unknown = operation('pay_invoice', 'unknown', 'reconciling');
  return {
    ...unknown,
    id: UNRESOLVED_OPERATION_ID,
    review: { ...unknown.review, operation_id: UNRESOLVED_OPERATION_ID },
    authorization: { status: 'consumed', mode: 'every_operation', expires_at: null },
    updated_at: '2026-10-21T12:00:10Z',
    last_reconciled_at: '2026-10-21T12:00:30Z',
  };
}

/**
 * The contract's channel, plus two built from it: an opening channel without reported balances,
 * and one whose balances leave 100,000 sat of capacity in neither.
 */
export function syntheticChannels() {
  const channel = fixture('channels_page').items[0];
  return [
    channel,
    { ...channel, id: 'channel-synthetic-opening', state: 'opening', private: false, local_msat: null, remote_msat: null, funding_outpoint: null },
    { ...channel, id: 'channel-synthetic-remainder', short_channel_id: '812x1x0', private: null, local_msat: '300000000', remote_msat: '600000000', spendable_msat: '290000000' },
  ];
}

export interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * Serves the frozen contract fixtures at the browser's network boundary and records every
 * non-GET request. Anything outside the app origin is aborted, so no external host is reached.
 */
export async function installSyntheticApi(page: Page): Promise<RecordedRequest[]> {
  const mutations: RecordedRequest[] = [];
  // Counts the one unresolved operation the journal list serves.
  const node = { ...fixture('node_lnd'), unresolved_operation_count: '1' };
  const page$ = (nodeId: string) => ({ node_id: nodeId, network: node.network, observed_at: '2026-10-21T12:00:00Z' });

  await page.clock.setFixedTime(FIXTURE_NOW);
  await page.context().route(/^(?!http:\/\/127\.0\.0\.1:4317\/)/, (route) => route.abort());
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    if (request.method() !== 'GET') {
      mutations.push({ method: request.method(), path, body: request.postDataJSON() });
    }
    const [, resource, nodeId, sub, operationId, action] = path.split('/');

    if (path === '/auth/bootstrap') return json(route, fixture('bootstrap'));
    if (path === '/session' && request.method() === 'DELETE') return route.fulfill({ status: 204 });
    if (path === '/session') return json(route, fixture('session'));
    if (path === '/config') return json(route, fixture('public_policy'));
    if (path === '/nodes') return json(route, { ...fixture('nodes_page'), items: [node], next_cursor: null, truncated: false });
    if (resource !== 'nodes' || nodeId !== node.id) return json(route, { error: { code: 'not_found', message: 'Not found.', request_id: '00000000-0000-4000-8000-0000000009fe', operation_id: null, outcome: 'not_applicable' } }, 404);
    if (sub === undefined) return json(route, node);
    if (sub === 'info') return json(route, { ...fixture('node_info'), node });
    if (sub === 'balances') return json(route, fixture('balances'));
    if (sub === 'policy') return json(route, fixture('node_policy'));
    if (sub === 'fee-estimates') return json(route, fixture('fee_estimates'));
    if (sub === 'invoices') return json(route, { ...fixture('invoices_page'), ...page$(nodeId) });
    if (sub === 'payments') return json(route, { ...fixture('payments_page'), ...page$(nodeId) });
    if (sub === 'peers') return json(route, { ...fixture('peers_page'), ...page$(nodeId) });
    if (sub === 'channels') return json(route, { ...fixture('channels_page'), ...page$(nodeId), items: syntheticChannels() });
    if (sub === 'transactions') return json(route, { ...fixture('transactions_page'), ...page$(nodeId) });
    if (sub === 'decode' && request.method() === 'POST') return json(route, fixture('decode'));
    if (sub === 'operations' && request.method() === 'POST' && operationId === undefined) {
      const body: unknown = request.postDataJSON();
      const kind = typeof body === 'object' && body !== null && 'kind' in body ? body.kind : null;
      return isKind(kind) ? json(route, operation(kind), 201) : route.abort();
    }
    if (sub === 'operations' && action === 'authorize' && request.method() === 'POST') {
      // A recent-mode grant bound to this operation: the real step-up path, without a browser prompt.
      const reviewed = OPERATION_KINDS.map((kind) => operation(kind)).find((op) => op.id === operationId);
      if (!reviewed) return route.abort();
      const grant = fixture('recent_authorize_start');
      return json(route, {
        ...grant,
        authorization: { ...grant.authorization, operation_id: reviewed.id, node_id: reviewed.node_id, review_digest: reviewed.review.digest },
      });
    }
    if (sub === 'operations' && action === 'confirm') {
      const created = OPERATION_KINDS.map((kind) => operation(kind)).find((op) => op.id === operationId);
      return created ? json(route, { ...created, state: 'pending', stage: 'submitted' }, 202) : route.abort();
    }
    if (sub === 'operations' && operationId === UNRESOLVED_OPERATION_ID) return json(route, unresolvedOperation());
    if (sub === 'operations' && operationId) {
      const found = OPERATION_KINDS.map((kind) => operation(kind)).find((op) => op.id === operationId);
      return found ? json(route, found) : route.abort();
    }
    if (sub === 'operations') {
      // One unresolved operation of this node, so the overview has an attention item.
      return json(route, { ...fixture('operations_page'), ...page$(nodeId), items: [unresolvedOperation()] });
    }
    return route.abort();
  });
  return mutations;
}
