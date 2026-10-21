import { useEffect, useRef } from 'react';
import { sessionCsrfToken } from '../api/csrf';

/** The screen or session that started an attempt is gone (navigation, node switch, sign-out). */
export class AttemptAbandonedError extends Error {
  constructor() {
    super('The attempt was abandoned because its screen or session ended.');
    this.name = 'AttemptAbandonedError';
  }
}

export interface Attempt {
  /** Aborts when the starting component unmounts. */
  signal: AbortSignal;
  /** True while the starting screen is open and the session that started it is still current. */
  isCurrent: () => boolean;
}

export function throwIfAbandoned(attempt: Attempt): void {
  if (!attempt.isCurrent()) throw new AttemptAbandonedError();
}

/**
 * Starts attempts tied to this component and to the current session. Steps not taken yet stop
 * once the attempt is no longer current, and its late results must not touch the cache or
 * navigation. A request already sent is never presented as undone.
 */
export function useAttempt(): () => Attempt {
  const current = useRef<AbortController | null>(null);
  useEffect(() => () => current.current?.abort(), []);
  return () => {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    const session = sessionCsrfToken();
    return {
      signal: controller.signal,
      isCurrent: () => !controller.signal.aborted && session !== null && sessionCsrfToken() === session,
    };
  };
}
