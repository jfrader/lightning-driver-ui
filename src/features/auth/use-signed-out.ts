import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { clearSessionCsrfToken } from '../../api/csrf';

/** Drops local session data; the notice distinguishes confirmed revocation from failure. */
export function useSignedOut(notice: 'signed_out' | 'sign_out_failed' = 'signed_out'): () => void {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return () => {
    clearSessionCsrfToken();
    queryClient.clear();
    void navigate({ to: '/login', search: { notice }, replace: true });
  };
}
