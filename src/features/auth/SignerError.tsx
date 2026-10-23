import { Alert } from '@jfrader/ui';
import { ErrorNotice } from '../../components/ErrorNotice';
import { NOSTR_FAILURE_MESSAGE, nostrFailure } from './nostr';
import { PASSKEY_FAILURE_MESSAGE, passkeyFailure } from './passkey';

/**
 * Passkey and Nostr prompt problems read as such, separate from server or operation errors. Nostr
 * first: without WebAuthn, the passkey classifier reads any other error as `unsupported`.
 */
export function SignerError({ error }: { error: unknown }) {
  const nostr = nostrFailure(error);
  if (nostr !== null) return <Alert tone={nostr === 'rejected' ? 'info' : 'warning'}>{NOSTR_FAILURE_MESSAGE[nostr]}</Alert>;
  const passkey = passkeyFailure(error);
  if (passkey !== null) return <Alert tone={passkey === 'canceled' ? 'info' : 'warning'}>{PASSKEY_FAILURE_MESSAGE[passkey]}</Alert>;
  return <ErrorNotice error={error} />;
}
