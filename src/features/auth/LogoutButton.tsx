import { Button } from '@jfrader/ui';
import { useMutation } from '@tanstack/react-query';
import { setSessionCsrfToken } from '../../api/csrf';
import { useControlSize } from '../shell/use-shell-layout';
import { getSession, logout } from './api';
import { useSignedOut } from './use-signed-out';

export function LogoutButton({ variant = 'ghost', retry = false }: { variant?: 'ghost' | 'outline'; retry?: boolean }) {
  const size = useControlSize();
  const signedOut = useSignedOut();
  const failed = useSignedOut('sign_out_failed');
  const mutation = useMutation({
    mutationFn: async () => {
      if (retry) setSessionCsrfToken((await getSession()).csrf_token);
      await logout();
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
