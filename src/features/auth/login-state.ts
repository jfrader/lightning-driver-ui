import type { AuthBootstrap, AuthMethod } from '../../api/types';

/** What this browser can run: WebAuthn for passkeys, a NIP-07 extension for Nostr. */
export type BrowserMethods = Record<AuthMethod, boolean>;

/**
 * Screens spec §6.1: L0 loading, L1 unsupported, L2 sign-in, L3 enroll, L4 no passkey, L5 bootstrap
 * error. Sign-in lists the methods it offers; unsupported lists what the browser lacks for the
 * methods the host offers.
 */
export type LoginState =
  | { kind: 'loading' | 'error' | 'no_method' }
  | { kind: 'sign_in'; passkey: boolean; nostr: boolean }
  | { kind: 'enroll' }
  | { kind: 'unsupported'; missing: readonly AuthMethod[] };

interface LoginStateInput {
  browser: BrowserMethods;
  bootstrap: { isError: boolean; data: AuthBootstrap | undefined };
  /** The operator chose to enroll from sign-in. */
  enrolling: boolean;
}

const METHODS: readonly AuthMethod[] = ['passkey', 'nostr'];

function usableOrMissing(browser: BrowserMethods, offered: Record<AuthMethod, boolean>, usable: LoginState): LoginState {
  const available = METHODS.filter((method) => offered[method]);
  return available.some((method) => browser[method])
    ? usable
    : { kind: 'unsupported', missing: available };
}

export function loginState({ browser, bootstrap, enrolling }: LoginStateInput): LoginState {
  if (bootstrap.isError) return { kind: 'error' };
  const data = bootstrap.data;
  if (!data) return { kind: 'loading' };
  // Either method can enroll; the host token decides, not the browser.
  const any = { passkey: true, nostr: true };
  if (data.enrollment_available && (enrolling || !data.login_available)) {
    return usableOrMissing(browser, any, { kind: 'enroll' });
  }
  if (data.login_available) {
    const offered = { passkey: data.passkey_login_available, nostr: data.nostr_login_available };
    const passkey = offered.passkey && browser.passkey;
    // Nostr stays visible without an extension, disabled with its reason, beside a usable passkey.
    return usableOrMissing(browser, offered, { kind: 'sign_in', passkey, nostr: offered.nostr });
  }
  return usableOrMissing(browser, any, { kind: 'no_method' });
}

/** L6/L7: why the operator is on sign-in, carried in the `notice` search param. */
export const LOGIN_NOTICE = {
  session_ended: 'Session ended.',
  signed_out: 'Signed out.',
} as const;

export type LoginNotice = keyof typeof LOGIN_NOTICE;
