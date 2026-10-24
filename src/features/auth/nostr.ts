import type { NostrEvent, NostrEventTemplate } from '../../api/types';
import { NostrSignerError, type NostrFailure } from './signer-errors';
export { hasNostrExtension } from './signer-state';
export { NostrSignerError, NOSTR_FAILURE_MESSAGE, type NostrFailure } from './signer-errors';

/**
 * Asks the selected signer to sign the server's event template. Only the contract's event fields are
 * kept, and the signed event must carry the template unchanged.
 */
export function signNostrEvent(template: NostrEventTemplate): Promise<NostrEvent> {
  return import('./signer').then((module) => module.signNostrEvent(template));
}

export function nostrFailure(error: unknown): NostrFailure | null {
  return error instanceof NostrSignerError ? error.failure : null;
}
