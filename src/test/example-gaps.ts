import type { AuthBootstrap, Session } from '../api/types';

/**
 * Fields the re-frozen v1 contract (GURI-2959) requires that the frozen backend examples do not
 * carry yet. Fixtures get them here so the examples stay byte-frozen; delete each entry once the
 * backend examples include it.
 */
export const EXAMPLE_GAPS: {
  bootstrap: Pick<AuthBootstrap, 'passkey_login_available' | 'nostr_login_available'>;
  session: Pick<Session, 'auth_method'>;
} = {
  bootstrap: { passkey_login_available: true, nostr_login_available: false },
  session: { auth_method: 'passkey' },
};
