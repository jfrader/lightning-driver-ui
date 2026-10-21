import { useQueryClient } from '@tanstack/react-query';
import { setSessionCsrfToken } from '../../api/csrf';
import type { Session } from '../../api/types';
import { sessionQueryKey } from './queries';

/** Stores a fresh session: drops anything cached before it, then keeps the new CSRF token in memory. */
export function useSessionStart(): (session: Session) => void {
  const queryClient = useQueryClient();
  return (session) => {
    queryClient.clear();
    setSessionCsrfToken(session.csrf_token);
    queryClient.setQueryData(sessionQueryKey, session);
  };
}
