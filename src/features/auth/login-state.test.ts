import { describe, expect, it } from 'vitest';
import { fixture } from '../../test/fixtures';
import { loginState } from './login-state';

const bootstrap = (login: boolean, enrollment: boolean) => ({
  isError: false,
  data: { ...fixture('bootstrap'), login_available: login, enrollment_available: enrollment },
});

describe('login state (screens spec §6.1)', () => {
  it('is L1 without WebAuthn, whatever the bootstrap says', () => {
    expect(loginState({ webauthn: false, bootstrap: bootstrap(true, true), enrolling: false })).toBe('unsupported');
  });

  it('is L0 while the bootstrap loads and L5 when it fails', () => {
    expect(loginState({ webauthn: true, bootstrap: { isError: false, data: undefined }, enrolling: false })).toBe('loading');
    expect(loginState({ webauthn: true, bootstrap: { isError: true, data: undefined }, enrolling: false })).toBe('error');
  });

  it.each([
    [true, false, false, 'sign_in'],
    [true, true, false, 'sign_in'],
    [true, true, true, 'enroll'],
    [false, true, false, 'enroll'],
    [false, false, false, 'no_passkey'],
    // Enrollment opens only when the host armed it, even if asked for.
    [true, false, true, 'sign_in'],
    [false, false, true, 'no_passkey'],
  ] as const)('login %s, enrollment %s, enrolling %s → %s', (login, enrollment, enrolling, state) => {
    expect(loginState({ webauthn: true, bootstrap: bootstrap(login, enrollment), enrolling })).toBe(state);
  });
});
