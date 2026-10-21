import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { API_BASE_PATH } from '../config';
import { fixture } from './fixtures';

export const api = (path: string) => `${API_BASE_PATH}${path}`;

export const writableNode = fixture('node_lnd');
export const readOnlyNode = fixture('node_lnd_rest_readonly_offline');
export const clnNode = fixture('node_cln');

const nodes = [writableNode, readOnlyNode, clnNode];

function pageFor(nodeId: string) {
  const node = nodes.find((item) => item.id === nodeId);
  return { node_id: nodeId, network: node?.network ?? 'unknown', observed_at: '2026-10-21T12:00:00Z' };
}

export function safeError(code: string, message: string, outcome = 'not_applicable', operationId: string | null = null) {
  return { error: { code, message, request_id: '00000000-0000-4000-8000-0000000009ff', operation_id: operationId, outcome } };
}

/** Default contract-shaped responses. Tests override single routes with `server.use`. */
export const handlers = [
  http.get(api('/auth/bootstrap'), () => HttpResponse.json(fixture('bootstrap'))),
  http.get(api('/session'), () => HttpResponse.json(fixture('session'))),
  http.get(api('/config'), () => HttpResponse.json({ ...fixture('public_policy'), operation_poll_seconds: 1 })),
  http.get(api('/nodes'), () =>
    HttpResponse.json({ ...fixture('nodes_page'), items: nodes, next_cursor: null, truncated: false }),
  ),
  http.get(api('/nodes/:nodeId'), ({ params }) => {
    const node = nodes.find((item) => item.id === params.nodeId);
    return node ? HttpResponse.json(node) : HttpResponse.json(safeError('not_found', 'Node not found.'), { status: 404 });
  }),
  http.get(api('/nodes/:nodeId/info'), ({ params }) => {
    const node = nodes.find((item) => item.id === params.nodeId) ?? writableNode;
    return HttpResponse.json({ ...fixture('node_info'), node });
  }),
  http.get(api('/nodes/:nodeId/balances'), ({ params }) =>
    params.nodeId === readOnlyNode.id
      ? HttpResponse.json(fixture('balances_stale'))
      : HttpResponse.json({ ...fixture('balances'), node_id: String(params.nodeId) }),
  ),
  http.get(api('/nodes/:nodeId/policy'), ({ params }) =>
    HttpResponse.json({ ...fixture('node_policy'), node_id: String(params.nodeId) }),
  ),
  http.get(api('/nodes/:nodeId/fee-estimates'), ({ params }) =>
    HttpResponse.json({ ...fixture('fee_estimates'), node_id: String(params.nodeId) }),
  ),
  http.get(api('/nodes/:nodeId/invoices'), ({ params }) =>
    HttpResponse.json({ ...fixture('invoices_page'), ...pageFor(String(params.nodeId)) }),
  ),
  http.get(api('/nodes/:nodeId/payments'), ({ params }) =>
    HttpResponse.json({ ...fixture('payments_page'), ...pageFor(String(params.nodeId)) }),
  ),
  http.get(api('/nodes/:nodeId/peers'), ({ params }) =>
    HttpResponse.json({ ...fixture('peers_page'), ...pageFor(String(params.nodeId)) }),
  ),
  http.get(api('/nodes/:nodeId/channels'), ({ params }) =>
    HttpResponse.json({ ...fixture('channels_page'), ...pageFor(String(params.nodeId)) }),
  ),
  http.get(api('/nodes/:nodeId/transactions'), ({ params }) =>
    HttpResponse.json({ ...fixture('transactions_page'), ...pageFor(String(params.nodeId)) }),
  ),
  http.get(api('/nodes/:nodeId/operations'), ({ params }) =>
    HttpResponse.json({ ...fixture('operations_page'), ...pageFor(String(params.nodeId)) }),
  ),
  http.post(api('/nodes/:nodeId/decode'), () => HttpResponse.json(fixture('decode'))),
];

export const server = setupServer(...handlers);
