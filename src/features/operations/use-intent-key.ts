import { useRef } from 'react';
import type { CreateOperationRequest } from '../../api/types';

/**
 * One Idempotency-Key per logical intent: repeated clicks or a resubmit after a lost response
 * reuse it, so the server returns the same review. Changing any input starts a new intent.
 */
export function useIntentKey(): (request: CreateOperationRequest) => string {
  const intent = useRef<{ fingerprint: string; key: string } | null>(null);
  return (request) => {
    const fingerprint = JSON.stringify(request);
    if (intent.current?.fingerprint !== fingerprint) {
      intent.current = { fingerprint, key: crypto.randomUUID() };
    }
    return intent.current.key;
  };
}
