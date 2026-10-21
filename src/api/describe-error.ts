import { ApiError, ContractError, SessionEndedError, TransportError } from './errors';

export interface ErrorDescription {
  title: string;
  message: string;
  requestId: string | null;
}

const STATUS_TITLE: Record<number, string> = {
  400: 'Request rejected',
  403: 'Not allowed',
  404: 'Not found',
  409: 'Conflict',
  410: 'List expired',
  422: 'Check the details',
  429: 'Too many requests',
  502: 'Node answered unexpectedly',
  503: 'Unavailable',
};

/** Literal, safe text for any error the API layer can throw. */
export function describeError(error: unknown): ErrorDescription {
  if (error instanceof ApiError) {
    const wait = error.retryAfterSeconds ? ` Try again in ${error.retryAfterSeconds} s.` : '';
    return {
      title: STATUS_TITLE[error.status] ?? 'Request failed',
      message: `${error.detail.message}${wait}`,
      requestId: error.detail.request_id,
    };
  }
  if (error instanceof SessionEndedError) {
    return { title: 'Signed out', message: 'Sign in again.', requestId: error.detail?.request_id ?? null };
  }
  if (error instanceof TransportError) {
    return { title: 'No response', message: error.message, requestId: null };
  }
  if (error instanceof ContractError) {
    return {
      title: 'Unexpected response',
      message: 'The server sent data this app cannot read safely. Nothing is shown from it.',
      requestId: null,
    };
  }
  return { title: 'Something went wrong', message: 'Reload the page and try again.', requestId: null };
}
