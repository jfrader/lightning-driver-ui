import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { Alert, Button, Flex } from '@jfrader/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { ErrorNotice } from '../../components/ErrorNotice';
import { InlineCode } from '../../components/InlineCode';
import { LoadingState } from '../../components/LoadingState';
import { TextLink } from '../../components/TextLink';
import { safeRedirectPath } from '../../lib/safe-redirect';
import { AuthLayout } from './AuthLayout';
import { signInWithPasskey } from './ceremonies';
import { PasskeyError } from './PasskeyError';
import { PASSKEY_FAILURE_MESSAGE } from './passkey';
import { bootstrapQueryOptions } from './queries';
import { useSessionStart } from './use-session-start';

const route = getRouteApi('/login');

export function LoginPage() {
  const { redirect } = route.useSearch();
  const navigate = useNavigate();
  const startSession = useSessionStart();
  const bootstrap = useQuery(bootstrapQueryOptions);
  const signIn = useMutation({
    mutationFn: signInWithPasskey,
    onSuccess: (session) => {
      startSession(session);
      void navigate({ href: safeRedirectPath(redirect), replace: true });
    },
  });

  if (!browserSupportsWebAuthn()) {
    return (
      <AuthLayout title="Sign in">
        <Alert tone="warning">{PASSKEY_FAILURE_MESSAGE.unsupported}</Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Sign in">
      {bootstrap.isPending && <LoadingState label="Loading sign-in" />}
      {bootstrap.isError && <ErrorNotice error={bootstrap.error} onRetry={() => void bootstrap.refetch()} />}
      {bootstrap.data && (
        <Flex direction="column" gap="md">
          {bootstrap.data.login_available ? (
            <Button tone="accent" size="lg" loading={signIn.isPending} onClick={() => signIn.mutate()}>
              Sign in with passkey
            </Button>
          ) : (
            <Alert tone="info" title="No passkey is enrolled">
              Run <InlineCode>api-server auth enrollment --config &lt;path&gt;</InlineCode> on the host, then enroll
              a passkey.
            </Alert>
          )}
          {signIn.isError && <PasskeyError error={signIn.error} />}
          {bootstrap.data.enrollment_available && <TextLink to="/enroll">Enroll a passkey</TextLink>}
        </Flex>
      )}
    </AuthLayout>
  );
}
