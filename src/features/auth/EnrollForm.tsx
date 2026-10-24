import { useState, type FormEvent } from 'react';
import { Button, Flex, SegmentedControl, styled } from '@jfrader/ui';
import { FormTextField } from '../../components/FormTextField';
import { wrappingControlText } from '../../components/control-styles';
import { useMutation } from '@tanstack/react-query';
import type { AuthMethod, Session } from '../../api/types';
import { isKeyOf, keysOf } from '../../lib/guards';
import { checkEnrollmentToken, checkHexEnrollmentToken, type Checked } from '../forms/validation';
import { useControlSize } from '../shell/use-shell-layout';
import { enrollNostr, enrollPasskey } from './ceremonies';
import { AUTH_METHOD_LABEL } from './labels';
import type { BrowserMethods } from './login-state';
import { SignInNotice } from './SignInNotice';
import { METHOD_COPY, signUpProblem } from './sign-in-problem';
import { useCooldown } from './use-cooldown';

const Line = styled.p({ margin: 0 });


interface EnrollMethod {
  submit: string;
  check: (text: string) => Checked<string>;
  enroll: (token: string) => Promise<Session>;
  /** The passkey token is claimed at start; a Nostr token survives until enrollment succeeds. */
  clearsToken: boolean;
}

const ENROLL_METHOD: Record<AuthMethod, EnrollMethod> = {
  passkey: { submit: 'Create passkey', check: checkEnrollmentToken, enroll: enrollPasskey, clearsToken: true },
  nostr: { submit: 'Sign with Nostr', check: checkHexEnrollmentToken, enroll: enrollNostr, clearsToken: false },
};

interface EnrollFormProps {
  browser: BrowserMethods;
  /** Present only when the host also allows sign-in. */
  onBack: (() => void) | null;
  onSession: (session: Session) => void;
  autoFocus: boolean;
}

/**
 * Screens spec §6.2: one host-issued token, a method, one action, then the browser's passkey or
 * Nostr prompt. A refused token keeps this form open: the new token from the host goes into the
 * same field.
 */
export function EnrollForm({ browser, onBack, onSession, autoFocus }: EnrollFormProps) {
  const size = useControlSize();
  const [token, setToken] = useState('');
  const [method, setMethod] = useState<AuthMethod>(browser.passkey ? 'passkey' : 'nostr');
  const [invalid, setInvalid] = useState<string | null>(null);
  const cooldown = useCooldown();
  const enroll = useMutation({
    mutationFn: ({ chosen, value }: { chosen: AuthMethod; value: string }) => ENROLL_METHOD[chosen].enroll(value),
    onSuccess: onSession,
    onError: (error, { chosen }) => {
      const problem = signUpProblem(error, chosen);
      if (problem.kind === 'rate_limited') cooldown.start(problem.seconds);
    },
  });
  const current = ENROLL_METHOD[method];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (enroll.isPending) return;
    const checked = current.check(token);
    if (!checked.ok) {
      setInvalid(checked.error);
      return;
    }
    // A claimed token leaves the field before the request.
    if (current.clearsToken) setToken('');
    setInvalid(null);
    enroll.mutate({ chosen: method, value: checked.value });
  };

  return (
    <form onSubmit={submit} noValidate>
      <Flex direction="column" gap="md">
        <FormTextField
          label="Enrollment token"
          type="text"
          description="Printed once by api-server auth enrollment on the host."
          // Matches the column's one primary action at every width.
          size="lg"
          value={token}
          onValueChange={(value) => {
            setToken(value);
            setInvalid(null);
          }}
          error={invalid}
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          // The field is the only control of this state; focus moves to it when the operator opens it.
          autoFocus={autoFocus}
          required
        />
        <Flex direction="column" gap="sm">
          <SegmentedControl
            label="Sign-in method"
            size={size}
            disabled={enroll.isPending}
            options={keysOf(AUTH_METHOD_LABEL).map((value) => ({
              value,
              label: AUTH_METHOD_LABEL[value],
              disabled: !browser[value],
            }))}
            value={method}
            onValueChange={(value) => {
              if (isKeyOf(AUTH_METHOD_LABEL, value)) setMethod(value);
            }}
          />
          {keysOf(AUTH_METHOD_LABEL)
            .filter((value) => !browser[value])
            .map((value) => (
              <Line key={value}>{METHOD_COPY[value].unsupported}</Line>
            ))}
        </Flex>
        <Button type="submit" tone="accent" size="lg" sx={wrappingControlText('lg')} loading={enroll.isPending} disabled={cooldown.active}>
          {current.submit}
        </Button>
        {enroll.isError && enroll.variables && <SignInNotice problem={signUpProblem(enroll.error, enroll.variables.chosen)} />}
        {onBack && (
          <Button variant="ghost" size={size} sx={wrappingControlText(size)} onClick={onBack} disabled={enroll.isPending}>
            Back to sign in
          </Button>
        )}
      </Flex>
    </form>
  );
}
