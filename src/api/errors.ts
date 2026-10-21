import type { ErrorDetail } from './types';

/** A safe error the API returned with its documented JSON body. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: ErrorDetail;
  readonly retryAfterSeconds: number | null;

  constructor(status: number, detail: ErrorDetail, retryAfterSeconds: number | null) {
    super(detail.message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** The response did not match the frozen contract (malformed amounts, wrong node, missing fields). */
export class ContractError extends Error {
  readonly path: string;

  constructor(path: string, reason: string) {
    super(`Unexpected response from ${path}: ${reason}`);
    this.name = 'ContractError';
    this.path = path;
  }
}

type TransportFailure = 'network' | 'timeout';

/** No response arrived. For a mutation this never proves the server did nothing. */
export class TransportError extends Error {
  readonly reason: TransportFailure;

  constructor(reason: TransportFailure) {
    super(reason === 'timeout' ? 'The server did not answer in time.' : 'The server could not be reached.');
    this.name = 'TransportError';
    this.reason = reason;
  }
}

/**
 * HTTP 401: the session that sent the request is no longer valid. The status is authoritative
 * even when the body is malformed. It says nothing about whether an operation ran.
 */
export class SessionEndedError extends Error {
  /** The contract error body, or `null` when the 401 body could not be read. */
  readonly detail: ErrorDetail | null;
  /** CSRF token of the session that sent the request; `null` for anonymous requests. */
  readonly session: string | null;

  constructor(detail: ErrorDetail | null, session: string | null) {
    super(detail?.message ?? 'The session ended.');
    this.name = 'SessionEndedError';
    this.detail = detail;
    this.session = session;
  }
}

export function isSessionLoss(error: unknown): error is SessionEndedError {
  return error instanceof SessionEndedError;
}

export function errorCode(error: unknown): ErrorDetail['code'] | null {
  if (error instanceof ApiError) return error.detail.code;
  if (error instanceof SessionEndedError) return error.detail?.code ?? null;
  return null;
}
