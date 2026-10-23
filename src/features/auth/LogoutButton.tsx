import { Button } from '@jfrader/ui';
import { useMutation } from '@tanstack/react-query';
import { useControlSize } from '../shell/use-shell-layout';
import { logout } from './api';
import { useSignedOut } from './use-signed-out';

export function LogoutButton({ variant = 'ghost' }: { variant?: 'ghost' | 'outline' }) {
  const size = useControlSize();
  const signedOut = useSignedOut();
  const mutation = useMutation({ mutationFn: logout, onSettled: signedOut });
  return (
    <Button size={size} variant={variant} loading={mutation.isPending} onClick={() => mutation.mutate()}>
      Sign out
    </Button>
  );
}
