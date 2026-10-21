import { useState, type FormEvent } from 'react';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { Alert, Button, Flex, PasswordField } from '@jfrader/ui';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { TextLink } from '../../components/TextLink';
import { AuthLayout } from './AuthLayout';
import { enrollPasskey } from './ceremonies';
import { PasskeyError } from './PasskeyError';
import { PASSKEY_FAILURE_MESSAGE } from './passkey';
import { useSessionStart } from './use-session-start';

const TOKEN_MIN_LENGTH = 32;
const TOKEN_MAX_LENGTH = 256;

export function EnrollPage() {
  const navigate = useNavigate();
  const startSession = useSessionStart();
  const [token, setToken] = useState('');
  const enroll = useMutation({
    mutationFn: enrollPasskey,
    onSuccess: (session) => {
      startSession(session);
      void navigate({ to: '/', replace: true });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = token.trim();
    setToken('');
    enroll.mutate(value);
  };

  if (!browserSupportsWebAuthn()) {
    return (
      <AuthLayout title="Enroll a passkey">
        <Alert tone="warning">{PASSKEY_FAILURE_MESSAGE.unsupported}</Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Enroll a passkey">
      <form onSubmit={submit}>
        <Flex direction="column" gap="md">
          <PasswordField
            label="Enrollment token"
            description="Printed once by api-server auth enrollment on the host."
            value={token}
            onValueChange={setToken}
            autoComplete="off"
            minLength={TOKEN_MIN_LENGTH}
            maxLength={TOKEN_MAX_LENGTH}
            required
          />
          <Button type="submit" tone="accent" loading={enroll.isPending}>
            Create passkey
          </Button>
          {enroll.isError && <PasskeyError error={enroll.error} />}
          <TextLink to="/login" search={{ redirect: undefined }}>
            Back to sign in
          </TextLink>
        </Flex>
      </form>
    </AuthLayout>
  );
}
