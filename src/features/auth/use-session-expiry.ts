import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SESSION_RECHECK_MIN_MS } from '../../config';
import { sessionQueryKey, sessionQueryOptions } from './queries';

/** Longest delay `setTimeout` honours; a later deadline is re-read when this fires. */
const MAX_TIMER_MS = 2 ** 31 - 1;

/**
 * At the session's earliest expiry (idle or absolute) the server is asked again. The server is
 * authoritative: activity may have moved the idle deadline, and an ended session answers 401,
 * which the app's session-loss handler turns into a clean return to sign-in.
 */
export function useSessionExpiry(): void {
  const queryClient = useQueryClient();
  const session = useQuery(sessionQueryOptions).data;

  useEffect(() => {
    if (!session) return;
    const deadline = Math.min(Date.parse(session.expires_at), Date.parse(session.idle_expires_at));
    if (Number.isNaN(deadline)) return;
    const recheck = () => void queryClient.refetchQueries({ queryKey: sessionQueryKey, exact: true });
    const delay = Math.min(Math.max(deadline - Date.now(), SESSION_RECHECK_MIN_MS), MAX_TIMER_MS);
    const timer = window.setTimeout(recheck, delay);
    // A sleeping device skips timers; waking past the deadline checks at once.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() >= deadline) recheck();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session, queryClient]);
}
