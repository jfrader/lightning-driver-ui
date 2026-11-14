import { Button } from '@jfrader/ui';
import { useMutation } from '@tanstack/react-query';
import { setSessionCsrfToken } from '../../api/csrf';
import { isSessionLoss } from '../../api/errors';
import { useControlSize } from '../shell/use-shell-layout';
import { getSession, logout } from './api';
import { useSignedOut } from './use-signed-out';

export function LogoutButton({ variant = 'ghost', retry = false }: { variant?: 'ghost' | 'outline'; retry?: boolean }) {
  const size = useControlSize();
  const signedOut = useSignedOut();
  const failed = useSignedOut('sign_out_failed');
  const mutation = useMutation({
    mutationFn: async () => {
      // A lost response can leave the server session revoked while the UI still shows the retry:
      // a 401 on the retry proves the goal, so it is a completed sign-out, not a new failure.
      if (retry) {
        try {
          setSessionCsrfToken((await getSession()).csrf_token);
        } catch (error) {
          if (isSessionLoss(error)) return;
          throw error;
        }
      }
      try {
        await logout();
      } catch (error) {
        if (isSessionLoss(error)) return;
        throw error;
      }
    },
    onSuccess: () => signedOut(),
    onError: failed,
  });
  return (
    <Button size={size} variant={variant} loading={mutation.isPending} onClick={() => mutation.mutate()}>
      {retry ? 'Retry sign out' : 'Sign out'}
    </Button>
  );
}
