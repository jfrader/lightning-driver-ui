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

export type TransportFailure = 'network' | 'timeout';

/** No response arrived. For a mutation this never proves the server did nothing. */
export class TransportError extends Error {
  readonly reason: TransportFailure;

  constructor(reason: TransportFailure) {
    super(reason === 'timeout' ? 'The server did not answer in time.' : 'The server could not be reached.');
    this.name = 'TransportError';
    this.reason = reason;
  }
}

export function isSessionLoss(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function errorCode(error: unknown): ErrorDetail['code'] | null {
  return error instanceof ApiError ? error.detail.code : null;
}
