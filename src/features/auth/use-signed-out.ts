import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { clearSession, publishSessionEvent } from './session-events';

/** Drops local session data; the notice distinguishes confirmed revocation from failure. */
export function useSignedOut(notice: 'signed_out' | 'sign_out_failed' = 'signed_out'): () => void {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return () => {
    clearSession(queryClient);
    publishSessionEvent(notice);
    void navigate({ to: '/login', search: { notice }, replace: true });
  };
}
