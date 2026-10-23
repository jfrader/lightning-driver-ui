import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { clearSessionCsrfToken } from '../../api/csrf';

/** Drops the ended session and everything read with it, then opens sign-in with `Signed out.` */
export function useSignedOut(): () => void {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return () => {
    clearSessionCsrfToken();
    queryClient.clear();
    void navigate({ to: '/login', search: { notice: 'signed_out' }, replace: true });
  };
}
