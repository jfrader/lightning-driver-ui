import { useState, type FormEvent } from 'react';
import { Button, Flex, TextField } from '@jfrader/ui';
import { useMutation } from '@tanstack/react-query';
import type { Session } from '../../api/types';
import { checkEnrollmentToken } from '../forms/validation';
import { useControlSize } from '../shell/use-shell-layout';
import { enrollPasskey } from './ceremonies';
import { SignInNotice } from './SignInNotice';
import { signUpProblem } from './sign-in-problem';
import { useCooldown } from './use-cooldown';

interface EnrollFormProps {
  /** Present only when the host also allows sign-in. */
  onBack: (() => void) | null;
  onSession: (session: Session) => void;
  autoFocus: boolean;
}

/**
 * Screens spec §6.2: one host-issued token, one action, then the browser's passkey prompt. A
 * refused token keeps this form open: the new token from the host goes into the same field.
 */
export function EnrollForm({ onBack, onSession, autoFocus }: EnrollFormProps) {
  const size = useControlSize();
  const [token, setToken] = useState('');
  const [invalid, setInvalid] = useState<string | null>(null);
  const cooldown = useCooldown();
  const enroll = useMutation({
    mutationFn: enrollPasskey,
    onSuccess: onSession,
    onError: (error) => {
      const problem = signUpProblem(error);
      if (problem.kind === 'rate_limited') cooldown.start(problem.seconds);
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const checked = checkEnrollmentToken(token);
    if (!checked.ok) {
      setInvalid(checked.error);
      return;
    }
    // The token is single-use and claimed at start: it leaves the field before the request.
    setToken('');
    setInvalid(null);
    enroll.mutate(checked.value);
  };

  return (
    <form onSubmit={submit} noValidate>
      <Flex direction="column" gap="md">
        <TextField
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
        <Button type="submit" tone="accent" size="lg" loading={enroll.isPending} disabled={cooldown.active}>
          Create passkey
        </Button>
        {enroll.isError && <SignInNotice problem={signUpProblem(enroll.error)} />}
        {onBack && (
          <Button variant="ghost" size={size} onClick={onBack} disabled={enroll.isPending}>
            Back to sign in
          </Button>
        )}
      </Flex>
    </form>
  );
}
