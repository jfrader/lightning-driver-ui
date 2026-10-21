import { Button } from '@jfrader/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { clearSessionCsrfToken } from '../../api/csrf';
import { logout } from './api';

export function LogoutButton() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      clearSessionCsrfToken();
      queryClient.clear();
      void navigate({ to: '/login', search: { redirect: undefined }, replace: true });
    },
  });
  return (
    <Button size="sm" variant="ghost" loading={mutation.isPending} onClick={() => mutation.mutate()}>
      Sign out
    </Button>
  );
}
