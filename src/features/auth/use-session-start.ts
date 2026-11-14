import { useQueryClient } from '@tanstack/react-query';
import { setSessionCsrfToken } from '../../api/csrf';
import type { Session } from '../../api/types';
import { sessionQueryKey } from './queries';
import { clearSession, publishSessionEvent } from './session-events';

/** Stores a fresh session: drops anything cached before it, then keeps the new CSRF token in memory. */
export function useSessionStart(): (session: Session) => void {
  const queryClient = useQueryClient();
  return (session) => {
    clearSession(queryClient, true);
    setSessionCsrfToken(session.csrf_token);
    queryClient.setQueryData(sessionQueryKey, session);
    publishSessionEvent('session_changed');
  };
}
