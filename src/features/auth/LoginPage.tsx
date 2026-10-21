import { useState } from 'react';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { Alert, Button, Flex, styled } from '@jfrader/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import type { Session } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { safeRedirectPath } from '../../lib/safe-redirect';
import { useControlSize } from '../shell/use-shell-layout';
import { visuallyHidden } from '../shell/visually-hidden';
import { AuthLayout } from './AuthLayout';
import { signInWithPasskey } from './ceremonies';
import { EnrollForm } from './EnrollForm';
import { HostInstruction } from './HostInstruction';
import { LOGIN_NOTICE, loginState } from './login-state';
import { bootstrapQueryOptions } from './queries';
import { SignInNotice } from './SignInNotice';
import { SIGN_IN_COPY, signInProblem } from './sign-in-problem';
import { useCooldown } from './use-cooldown';
import { useSessionStart } from './use-session-start';

const route = getRouteApi('/login');

const Hidden = styled.span(visuallyHidden);
const Line = styled.p({ margin: 0 });

/** Screens spec §6: `/login` holds sign-in, enrollment and the host-only recovery wording. */
export function LoginPage() {
  const { redirect, notice } = route.useSearch();
  const navigate = useNavigate();
  const startSession = useSessionStart();
  const size = useControlSize();
  const bootstrap = useQuery(bootstrapQueryOptions);
  const [enrolling, setEnrolling] = useState(false);
  // Leaving enrollment returns focus to the sign-in action the operator came from.
  const [backFromEnroll, setBackFromEnroll] = useState(false);
  const cooldown = useCooldown();

  const enter = (session: Session) => {
    startSession(session);
    void navigate({ href: safeRedirectPath(redirect), replace: true });
  };
  const signIn = useMutation({
    mutationFn: signInWithPasskey,
    onSuccess: enter,
    onError: (error) => {
      const problem = signInProblem(error);
      if (problem.kind === 'rate_limited') cooldown.start(problem.seconds);
    },
  });
  const reload = (
    <Button variant="outline" size={size} onClick={() => void bootstrap.refetch()} loading={bootstrap.isFetching}>
      Reload
    </Button>
  );

  const state = loginState({ webauthn: browserSupportsWebAuthn(), bootstrap, enrolling });
  switch (state) {
    case 'loading':
      return (
        <AuthLayout title="Sign in" busy>
          <Hidden role="status">Loading sign-in</Hidden>
        </AuthLayout>
      );
    case 'unsupported':
      return (
        <AuthLayout title="Sign in">
          <Line>{SIGN_IN_COPY.unsupported}</Line>
        </AuthLayout>
      );
    case 'error':
      return (
        <AuthLayout title="Sign in">
          <ErrorNotice error={bootstrap.error} />
          {reload}
        </AuthLayout>
      );
    case 'no_passkey':
      return (
        <AuthLayout title="Sign in">
          <Flex direction="column" gap="sm">
            <Line>{SIGN_IN_COPY.noPasskey}</Line>
            <HostInstruction ending=", then reload this page." />
          </Flex>
          {reload}
        </AuthLayout>
      );
    case 'enroll':
      return (
        <AuthLayout title="Enroll a passkey">
          <EnrollForm
            onBack={
              bootstrap.data?.login_available
                ? () => {
                    setEnrolling(false);
                    setBackFromEnroll(true);
                  }
                : null
            }
            onSession={enter}
            autoFocus={enrolling}
          />
        </AuthLayout>
      );
    case 'sign_in':
      return (
        <AuthLayout title="Sign in">
          {notice && <Alert tone="info">{LOGIN_NOTICE[notice]}</Alert>}
          <Button
            tone="accent"
            size="lg"
            loading={signIn.isPending}
            disabled={cooldown.active}
            autoFocus={backFromEnroll}
            onClick={() => signIn.mutate()}
          >
            Continue with passkey
          </Button>
          {signIn.isError && <SignInNotice problem={signInProblem(signIn.error)} />}
          {bootstrap.data?.enrollment_available && (
            <Button variant="ghost" size={size} onClick={() => setEnrolling(true)} disabled={signIn.isPending}>
              Enroll a passkey
            </Button>
          )}
        </AuthLayout>
      );
  }
}
