import { useEffect, useReducer, useSyncExternalStore } from 'react';

const TICK_MS = 15_000;
const MAX_TIMEOUT_MS = 2_147_483_647;
const listeners = new Set<() => void>();
let revision = 0;
let timer: number | undefined;

function tick() {
  revision += 1;
  listeners.forEach((listener) => listener());
}

function syncVisibility() {
  window.clearInterval(timer);
  timer = undefined;
  if (!document.hidden) {
    tick();
    timer = window.setInterval(tick, TICK_MS);
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener('visibilitychange', syncVisibility);
    syncVisibility();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.clearInterval(timer);
      timer = undefined;
      document.removeEventListener('visibilitychange', syncVisibility);
    }
  };
}

function snapshot() {
  return revision;
}

/**
 * The current time at every render, so a timestamp that just arrived is compared with the present,
 * not with the last tick. The shared periodic tick keeps idle timestamp leaves current.
 */
export function useNow(): number {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return Date.now();
}

/** Action deadlines update at expiry, independently of the visibility-aware display clock. */
export function useDeadlineNow(expiresAt: string): number {
  const [, update] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    let timeout: number | undefined;
    const schedule = () => {
      const remaining = Date.parse(expiresAt) - Date.now();
      if (remaining > 0) {
        timeout = window.setTimeout(() => {
          update();
          schedule();
        }, Math.min(remaining, MAX_TIMEOUT_MS));
      }
    };
    schedule();
    return () => window.clearTimeout(timeout);
  }, [expiresAt]);
  return Date.now();
}
