import { useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { ErrorNotice } from './ErrorNotice';

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <ErrorNotice
      error={error}
      onRetry={() => {
        reset();
        void router.invalidate();
      }}
    />
  );
}
