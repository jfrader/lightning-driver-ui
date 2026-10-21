import { HttpResponse, http } from 'msw';
import { fixture } from './fixtures';
import { api, server } from './server';

type Kind =
  | 'create_invoice'
  | 'pay_invoice'
  | 'connect_peer'
  | 'disconnect_peer'
  | 'open_channel'
  | 'send_onchain'
  | 'new_address'
  | 'close_channel';
type State = 'awaiting_confirmation' | 'dispatching' | 'pending' | 'unknown' | 'succeeded' | 'failed' | 'expired';

/** A contract-shaped operation for `kind`, assembled from the frozen fixtures. */
export function operation(kind: Kind, state: State = 'awaiting_confirmation', stage = 'not_dispatched', withResult = false) {
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

interface JournalConfig {
  /** Operation returned by the create endpoint. */
  created: ReturnType<typeof operation>;
  /** Response of the confirm endpoint. */
  confirm?: () => Response;
  /** Successive GET responses; the last one repeats. */
  reads?: ReturnType<typeof operation>[];
}

export interface JournalCalls {
  creates: { nodeId: string; key: string | null; body: unknown }[];
  authorizes: { nodeId: string; operationId: string; body: unknown }[];
  finishes: { nodeId: string; operationId: string; body: unknown }[];
  confirms: { nodeId: string; operationId: string; body: unknown }[];
  reads: number;
}

/** Fake operation journal at the network boundary that records every mutation request. */
export function mockJournal(config: JournalConfig): JournalCalls {
  const calls: JournalCalls = { creates: [], authorizes: [], finishes: [], confirms: [], reads: 0 };
  const reads = config.reads ?? [config.created];
  server.use(
    http.post(api('/nodes/:nodeId/operations'), async ({ request, params }) => {
      calls.creates.push({
        nodeId: String(params.nodeId),
        key: request.headers.get('Idempotency-Key'),
        body: await request.json(),
      });
      return HttpResponse.json(config.created, { status: 201 });
    }),
    http.get(api('/nodes/:nodeId/operations/:operationId'), () => {
      const response = reads[Math.min(calls.reads, reads.length - 1)];
      calls.reads += 1;
      return HttpResponse.json(response);
    }),
    http.post(api('/nodes/:nodeId/operations/:operationId/authorize'), async ({ request, params }) => {
      calls.authorizes.push({ nodeId: String(params.nodeId), operationId: String(params.operationId), body: await request.json() });
      return HttpResponse.json(fixture('strict_authorize_start'));
    }),
    http.post(api('/nodes/:nodeId/operations/:operationId/authorize/finish'), async ({ request, params }) => {
      calls.finishes.push({ nodeId: String(params.nodeId), operationId: String(params.operationId), body: await request.json() });
      return HttpResponse.json({ ...fixture('operation_authorization'), operation_id: String(params.operationId), review_digest: config.created.review.digest });
    }),
    http.post(api('/nodes/:nodeId/operations/:operationId/confirm'), async ({ request, params }) => {
      calls.confirms.push({ nodeId: String(params.nodeId), operationId: String(params.operationId), body: await request.json() });
      return config.confirm ? config.confirm() : HttpResponse.json({ ...config.created, state: 'pending', stage: 'submitted' }, { status: 202 });
    }),
  );
  return calls;
}
