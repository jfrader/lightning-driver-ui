import { Alert } from '@jfrader/ui';
import { ErrorNotice } from '../../components/ErrorNotice';
import { PASSKEY_FAILURE_MESSAGE, passkeyFailure } from './passkey';

/** Passkey prompt problems read as such, separate from server or operation errors. */
export function PasskeyError({ error }: { error: unknown }) {
  const failure = passkeyFailure(error);
  if (failure === null) return <ErrorNotice error={error} />;
  return <Alert tone={failure === 'canceled' ? 'info' : 'warning'}>{PASSKEY_FAILURE_MESSAGE[failure]}</Alert>;
}
