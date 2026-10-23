import { describe, expect, it } from 'vitest';
import { fixture } from '../../test/fixtures';
import { loginState, type BrowserMethods } from './login-state';

interface Host {
  passkeys?: boolean;
  nostr?: boolean;
  enrollment?: boolean;
}

const bootstrap = ({ passkeys = false, nostr = false, enrollment = false }: Host) => ({
  isError: false,
  data: {
    ...fixture('bootstrap'),
    login_available: passkeys || nostr,
    passkey_login_available: passkeys,
    nostr_login_available: nostr,
    enrollment_available: enrollment,
  },
});

const both: BrowserMethods = { passkey: true, nostr: true };
const webauthnOnly: BrowserMethods = { passkey: true, nostr: false };
const extensionOnly: BrowserMethods = { passkey: false, nostr: true };
const neither: BrowserMethods = { passkey: false, nostr: false };

describe('login state (screens spec §6.1)', () => {
  it('is L0 while the bootstrap loads and L5 when it fails, whatever the browser', () => {
    expect(loginState({ browser: neither, bootstrap: { isError: false, data: undefined }, enrolling: false })).toEqual({
      kind: 'loading',
    });
    expect(loginState({ browser: neither, bootstrap: { isError: true, data: undefined }, enrolling: false })).toEqual({
      kind: 'error',
    });
  });

  it.each([
    [{ passkeys: true }, false, 'sign_in'],
    [{ passkeys: true, enrollment: true }, false, 'sign_in'],
    [{ passkeys: true, enrollment: true }, true, 'enroll'],
    [{ enrollment: true }, false, 'enroll'],
    [{}, false, 'no_method'],
    // Enrollment opens only when the host armed it, even if asked for.
    [{ passkeys: true }, true, 'sign_in'],
    [{}, true, 'no_method'],
  ] as const)('passkey browser, host %j, enrolling %s → %s', (host, enrolling, kind) => {
    expect(loginState({ browser: webauthnOnly, bootstrap: bootstrap(host), enrolling }).kind).toBe(kind);
  });

  it.each([
    // Host offers, browser can run → state, with the sign-in actions shown.
    [{ passkeys: true }, both, { kind: 'sign_in', passkey: true, nostr: false }],
    [{ passkeys: true, nostr: true }, both, { kind: 'sign_in', passkey: true, nostr: true }],
    // Without an extension the Nostr action stays, disabled, beside a usable passkey.
    [{ passkeys: true, nostr: true }, webauthnOnly, { kind: 'sign_in', passkey: true, nostr: true }],
    // Without WebAuthn, a Nostr extension and a Nostr identity are enough.
    [{ passkeys: true, nostr: true }, extensionOnly, { kind: 'sign_in', passkey: false, nostr: true }],
    [{ nostr: true }, extensionOnly, { kind: 'sign_in', passkey: false, nostr: true }],
    [{ nostr: true }, both, { kind: 'sign_in', passkey: false, nostr: true }],
    // Unsupported names only what the browser lacks for what the host offers.
    [{ passkeys: true }, extensionOnly, { kind: 'unsupported', missing: ['passkey'] }],
    [{ passkeys: true }, neither, { kind: 'unsupported', missing: ['passkey'] }],
    [{ nostr: true }, webauthnOnly, { kind: 'unsupported', missing: ['nostr'] }],
    [{ passkeys: true, nostr: true }, neither, { kind: 'unsupported', missing: ['passkey', 'nostr'] }],
  ] as const)('sign-in: host %j, browser %j → %j', (host, browser, state) => {
    expect(loginState({ browser, bootstrap: bootstrap(host), enrolling: false })).toEqual(state);
  });

  it.each([
    [webauthnOnly, { kind: 'enroll' }],
    [extensionOnly, { kind: 'enroll' }],
    [neither, { kind: 'unsupported', missing: ['passkey', 'nostr'] }],
  ] as const)('enrollment needs one method this browser can run: %j → %j', (browser, state) => {
    expect(loginState({ browser, bootstrap: bootstrap({ enrollment: true }), enrolling: false })).toEqual(state);
  });

  it('names the host command to an empty server in any browser that can enroll', () => {
    expect(loginState({ browser: extensionOnly, bootstrap: bootstrap({}), enrolling: false })).toEqual({ kind: 'no_method' });
    expect(loginState({ browser: neither, bootstrap: bootstrap({}), enrolling: false })).toEqual({
      kind: 'unsupported',
      missing: ['passkey', 'nostr'],
    });
  });
});
