import { useEffect, useRef } from 'react';

/** The screen that started an attempt is gone (navigation, node switch, session loss). */
export class AttemptAbandonedError extends Error {
  constructor() {
    super('The attempt was abandoned because its screen closed.');
    this.name = 'AttemptAbandonedError';
  }
}

export function throwIfAbandoned(signal: AbortSignal): void {
  if (signal.aborted) throw new AttemptAbandonedError();
}

/**
 * Returns a function that starts an attempt and gives its AbortSignal. The signal aborts when
 * the component unmounts, so async work started from this screen can stop before any step it
 * has not taken yet.
 */
export function useAttemptSignal(): () => AbortSignal {
  const current = useRef<AbortController | null>(null);
  useEffect(() => () => current.current?.abort(), []);
  return () => {
    current.current?.abort();
    current.current = new AbortController();
    return current.current.signal;
  };
}
