import { lazy, Suspense, useId, useRef, useState } from 'react';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { Alert, Button, Flex, styled } from '@jfrader/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getRouteApi, useNavigate, useRouter } from '@tanstack/react-router';
import type { AuthMethod, Session } from '../../api/types';
import { ErrorNotice } from '../../components/ErrorNotice';
import { wrappingControlText } from '../../components/control-styles';
import { safeRedirectPath } from '../../lib/safe-redirect';
import { useControlSize } from '../shell/use-shell-layout';
import { visuallyHidden } from '../shell/visually-hidden';
import { AuthLayout } from './AuthLayout';
import { signInWithNostr, signInWithPasskey } from './ceremonies';
import { HostInstruction } from './HostInstruction';
import { LOGIN_NOTICE, loginState } from './login-state';
import { NostrSignerControl } from './NostrSignerControl';
import { useNostrSigner } from './use-nostr-signer';
import { bootstrapQueryOptions } from './queries';
import { SignInNotice } from './SignInNotice';
import { METHOD_COPY, SIGN_IN_COPY, signInProblem } from './sign-in-problem';
import { useCooldown } from './use-cooldown';
import { useSessionStart } from './use-session-start';

const EnrollForm = lazy(() => import('./EnrollForm').then((module) => ({ default: module.EnrollForm })));
const route = getRouteApi('/login');

const Hidden = styled.span(visuallyHidden);
const Line = styled.p({ margin: 0 });

const SIGN_IN: Record<AuthMethod, () => Promise<Session>> = {
  passkey: signInWithPasskey,
  nostr: signInWithNostr,
};

/** Screens spec §6: `/login` holds sign-in, enrollment and the host-only recovery wording. */
export function LoginPage() {
  const { redirect, notice, enroll } = route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const startSession = useSessionStart();
  const size = useControlSize();
  const bootstrap = useQuery(bootstrapQueryOptions);
  const enrolling = enroll === 1;
  const enteredEnrollment = useRef(false);
  // Leaving enrollment returns focus to the sign-in action the operator came from.
  const [backFromEnroll, setBackFromEnroll] = useState(false);
  const cooldown = useCooldown();
  const nostrReasonId = useId();
  const signerAvailable = useNostrSigner();

  const enter = (session: Session) => {
    startSession(session);
    void navigate({ href: safeRedirectPath(redirect), replace: true });
  };
  const signIn = useMutation({
    mutationFn: (method: AuthMethod) => SIGN_IN[method](),
    onSuccess: enter,
    onError: (error, method) => {
      const problem = signInProblem(error, method);
      if (problem.kind === 'rate_limited') cooldown.start(problem.seconds);
    },
  });
  const reload = (
    <Button variant="outline" size={size} sx={wrappingControlText(size)} onClick={() => void bootstrap.refetch()} loading={bootstrap.isFetching}>
      Reload
    </Button>
  );
  const enrollmentAction = bootstrap.data?.enrollment_available && (
    <Button variant="ghost" size={size} sx={wrappingControlText(size)} onClick={() => {
      enteredEnrollment.current = true;
      setBackFromEnroll(true);
      void navigate({ to: '/login', search: { redirect, notice, enroll: 1 } });
    }} disabled={signIn.isPending}>
      Enroll a sign-in method
    </Button>
  );

  const browser = { passkey: browserSupportsWebAuthn(), nostr: signerAvailable };
  const state = loginState({ browser: { ...browser, nostr: true }, bootstrap, enrolling });
  switch (state.kind) {
    case 'loading':
      return (
        <AuthLayout title="Sign in" busy>
          <Hidden role="status">Loading sign-in</Hidden>
        </AuthLayout>
      );
    case 'unsupported':
      return (
        <AuthLayout title="Sign in">
          {state.missing.map((method) => (
            <Line key={method}>{METHOD_COPY[method].unsupported}</Line>
          ))}
          {enrollmentAction}
        </AuthLayout>
      );
    case 'error':
      return (
        <AuthLayout title="Sign in">
          <ErrorNotice error={bootstrap.error} />
          {reload}
        </AuthLayout>
      );
    case 'no_method':
      return (
        <AuthLayout title="Sign in">
          <Flex direction="column" gap="sm">
            <Line>{SIGN_IN_COPY.noMethod}</Line>
            <HostInstruction ending=", then reload this page." />
          </Flex>
          {reload}
        </AuthLayout>
      );
    case 'enroll':
      return (
        <AuthLayout title="Enroll">
          <Suspense fallback={<Hidden role="status">Loading enrollment</Hidden>}>
            <EnrollForm
              browser={browser}
              onBack={
                bootstrap.data?.login_available
                  ? () => {
                      if (enteredEnrollment.current) router.history.back();
                      else void navigate({ to: '/login', search: { redirect, notice }, replace: true });
                      setBackFromEnroll(true);
                    }
                  : null
              }
              onSession={enter}
              autoFocus={enteredEnrollment.current}
            />
          </Suspense>
        </AuthLayout>
      );
    case 'sign_in': {
      const pending = (method: AuthMethod) => signIn.isPending && signIn.variables === method;
      // Passkey stays the primary action; Nostr takes that role only when it is the sole method.
      const nostrPrimary = !state.passkey;
      return (
        <AuthLayout title="Sign in">
          {notice && <Alert tone="info">{LOGIN_NOTICE[notice]}</Alert>}
          {state.passkey && (
            <Button
              tone="accent"
              size="lg"
              sx={wrappingControlText('lg')}
              loading={pending('passkey')}
              disabled={cooldown.active || pending('nostr')}
              autoFocus={backFromEnroll}
              onClick={() => signIn.mutate('passkey')}
            >
              Continue with passkey
            </Button>
          )}
          {state.nostr && (
            <Flex direction="column" gap="sm">
              <Button
                tone={nostrPrimary ? 'accent' : undefined}
                variant={nostrPrimary ? 'solid' : 'outline'}
                size={nostrPrimary ? 'lg' : size}
                sx={wrappingControlText(nostrPrimary ? 'lg' : size)}
                loading={pending('nostr')}
                disabled={!browser.nostr || cooldown.active || pending('passkey')}
                autoFocus={backFromEnroll && nostrPrimary}
                aria-describedby={browser.nostr ? undefined : nostrReasonId}
                onClick={() => signIn.mutate('nostr')}
              >
                Sign in with Nostr
              </Button>
              {!browser.nostr && <Line id={nostrReasonId}>{METHOD_COPY.nostr.unsupported}</Line>}
              <NostrSignerControl disabled={signIn.isPending} />
            </Flex>
          )}
          {signIn.isError && signIn.variables && (
            <SignInNotice problem={signInProblem(signIn.error, signIn.variables)} />
          )}
          {enrollmentAction}
        </AuthLayout>
      );
    }
  }
}
