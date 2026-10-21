import { API_BASE_PATH, REQUEST_TIMEOUT_MS } from '../config';
import { sessionCsrfToken } from './csrf';
import { ApiError, ContractError, SessionEndedError, TransportError } from './errors';
import { ErrorResponse, type ContractValidator } from './generated/validators';

export type CsrfSource = { kind: 'session' } | { kind: 'preauth'; token: string } | { kind: 'none' };

interface RequestOptions<TBody> {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: TBody;
  bodyValidator?: ContractValidator<TBody>;
  csrf?: CsrfSource;
  idempotencyKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Rejects a response that belongs to a different node than the one requested. */
export function expectNode<T>(path: string, expectedNodeId: string, actualNodeId: string | null, value: T): T {
  if (actualNodeId !== expectedNodeId) throw new ContractError(path, `response is for node ${actualNodeId ?? 'none'}`);
  return value;
}

export function nodePath(nodeId: string, ...segments: string[]): string {
  return ['/nodes', nodeId, ...segments].map((part, index) => (index === 0 ? part : encodeURIComponent(part))).join('/');
}

function buildUrl(path: string, query: RequestOptions<unknown>['query']): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.set(key, String(value));
  }
  const search = params.toString();
  return `${API_BASE_PATH}${path}${search ? `?${search}` : ''}`;
}

function csrfToken(source: CsrfSource): string | null {
  if (source.kind === 'preauth') return source.token;
  if (source.kind === 'session') return sessionCsrfToken();
  return null;
}

function describeErrors(validator: ContractValidator<unknown>): string {
  const first = validator.errors?.[0];
  return first ? `${first.instancePath || 'body'} ${first.message ?? 'is invalid'}` : 'body is invalid';
}

async function readJson(response: Response, path: string): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ContractError(path, 'body is not JSON');
  }
}

function retryAfter(response: Response): number | null {
  const value = Number(response.headers.get('Retry-After'));
  return Number.isInteger(value) && value > 0 ? value : null;
}

async function send(url: string, init: RequestInit, signal: AbortSignal | undefined, timeoutMs: number) {
  const timeout = AbortSignal.timeout(timeoutMs);
  try {
    return await fetch(url, { ...init, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new TransportError(timeout.aborted ? 'timeout' : 'network');
  }
}

async function perform<TBody>(options: RequestOptions<TBody>): Promise<Response> {
  const { method, path, body, bodyValidator, idempotencyKey, signal } = options;
  if (bodyValidator && !bodyValidator(body)) {
    throw new ContractError(path, `request ${describeErrors(bodyValidator)}`);
  }

  const requestSession = sessionCsrfToken();
  const headers = new Headers({ Accept: 'application/json' });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  const token = csrfToken(options.csrf ?? (method === 'GET' ? { kind: 'none' } : { kind: 'session' }));
  if (token) headers.set('X-CSRF-Token', token);
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);

  const response = await send(
    buildUrl(path, options.query),
    {
      method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    signal,
    options.timeoutMs ?? REQUEST_TIMEOUT_MS,
  );

  if (response.status === 401) {
    const errorBody = await response.json().catch(() => null);
    throw new SessionEndedError(ErrorResponse(errorBody) ? errorBody.error : null, requestSession);
  }
  if (!response.ok) {
    const errorBody = await readJson(response, path);
    if (!ErrorResponse(errorBody)) throw new ContractError(path, `error ${response.status} ${describeErrors(ErrorResponse)}`);
    throw new ApiError(response.status, errorBody.error, retryAfter(response));
  }
  return response;
}

/**
 * Same-origin JSON request. Every response body is validated against the frozen contract,
 * so malformed amounts or missing fields surface as ContractError instead of rendering.
 */
export async function apiRequest<TResponse, TBody = never>(
  options: RequestOptions<TBody> & { response: ContractValidator<TResponse> },
): Promise<TResponse> {
  const response = await perform(options);
  const data = await readJson(response, options.path);
  if (!options.response(data)) throw new ContractError(options.path, describeErrors(options.response));
  return data;
}

export async function apiRequestNoContent<TBody = never>(options: RequestOptions<TBody>): Promise<void> {
  const response = await perform(options);
  if (response.status !== 204) throw new ContractError(options.path, `expected 204, got ${response.status}`);
}
