import type { AuthBootstrap } from '../../api/types';

/** Screens spec §6.1: L0 loading, L1 unsupported, L2 sign-in, L3 enroll, L4 no passkey, L5 bootstrap error. */
export type LoginState = 'loading' | 'unsupported' | 'sign_in' | 'enroll' | 'no_passkey' | 'error';

interface LoginStateInput {
  webauthn: boolean;
  bootstrap: { isError: boolean; data: AuthBootstrap | undefined };
  /** The operator chose `Enroll a passkey` from sign-in. */
  enrolling: boolean;
}

export function loginState({ webauthn, bootstrap, enrolling }: LoginStateInput): LoginState {
  if (!webauthn) return 'unsupported';
  if (bootstrap.isError) return 'error';
  const data = bootstrap.data;
  if (!data) return 'loading';
  if (data.enrollment_available && (enrolling || !data.login_available)) return 'enroll';
  if (data.login_available) return 'sign_in';
  return 'no_passkey';
}

/** L6/L7: why the operator is on sign-in, carried in the `notice` search param. */
export const LOGIN_NOTICE = {
  session_ended: 'Session ended.',
  signed_out: 'Signed out.',
} as const;

export type LoginNotice = keyof typeof LOGIN_NOTICE;
