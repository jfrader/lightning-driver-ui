import { useEffect, useReducer } from 'react';

const TICK_MS = 15_000;

/**
 * The current time at every render, so a timestamp that just arrived is compared with the present,
 * not with the last tick. The periodic tick only re-renders idle screens so ages keep moving.
 */
export function useNow(): number {
  const [, tick] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    const timer = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(timer);
  }, []);
  return Date.now();
}
