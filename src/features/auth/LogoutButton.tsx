import { Button } from '@jfrader/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { clearSessionCsrfToken } from '../../api/csrf';
import { useControlSize } from '../shell/use-shell-layout';
import { logout } from './api';

export function LogoutButton({ variant = 'ghost' }: { variant?: 'ghost' | 'outline' }) {
  const size = useControlSize();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      clearSessionCsrfToken();
      queryClient.clear();
      void navigate({ to: '/login', search: { notice: 'signed_out' }, replace: true });
    },
  });
  return (
    <Button size={size} variant={variant} loading={mutation.isPending} onClick={() => mutation.mutate()}>
      Sign out
    </Button>
  );
}
