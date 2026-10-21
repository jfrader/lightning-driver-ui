import { ApiError, ContractError, TransportError } from '../../api/errors';

export class UnansweredConfirmationError extends Error {
  constructor() {
    super('The server did not answer the confirmation.');
    this.name = 'UnansweredConfirmationError';
  }
}

/**
 * True when a confirm request may have reached the server but no trustworthy answer came back.
 * The operation is then observed through status reads only; it is never confirmed again
 * automatically.
 */
export function isUnansweredConfirmation(error: unknown): boolean {
  if (error instanceof TransportError || error instanceof ContractError) return true;
  if (!(error instanceof ApiError)) return false;
  const { outcome } = error.detail;
  return outcome === 'unknown' || (error.status >= 500 && outcome === 'not_applicable');
}
