import { useRef } from 'react';
import type { CreateOperationRequest } from '../../api/types';

/**
 * One Idempotency-Key per logical intent: repeated clicks or a resubmit after a lost response
 * reuse it, so the server returns the same review. Changing any input starts a new intent, and
 * `forget` drops the key when the server reports it was used for different inputs.
 */
export function useIntentKey() {
  const intent = useRef<{ fingerprint: string; key: string } | null>(null);
  return {
    keyFor: (request: CreateOperationRequest): string => {
      const fingerprint = JSON.stringify(request);
      if (intent.current?.fingerprint !== fingerprint) {
        intent.current = { fingerprint, key: crypto.randomUUID() };
      }
      return intent.current.key;
    },
    forget: () => {
      intent.current = null;
    },
  };
}
