import { ApiError, errorCode } from '../../api/errors';
import type { ErrorCode } from '../../api/types';
import { formatSeconds } from '../../lib/duration';
import { PASSKEY_FAILURE_MESSAGE, passkeyFailure } from './passkey';

/** Host command that issues an enrollment token. Recovery has no frozen command, so none is printed (G-9). */
export const ENROLLMENT_COMMAND = 'api-server auth enrollment --config <path>';

/** Screens spec §6.3. Login drops the reviews' `Nothing was sent.`: nothing can be sent from here. */
export const SIGN_IN_COPY = {
  canceled: 'Passkey request canceled.',
  notEnrolled: 'This passkey is not enrolled on this server.',
  expired: 'The sign-in request expired. Continue with passkey again.',
  rejected: 'Sign-in was rejected by the server. Reload this page.',
  enrollmentDisabled: 'Enrollment is disabled on this host.',
  noPasskey: 'No passkey is enrolled.',
  unsupported: PASSKEY_FAILURE_MESSAGE.unsupported,
} as const;

export const rateLimitedText = (seconds: number) => `Too many attempts. Try again in ${formatSeconds(seconds)}.`;

export type SignInProblem =
  | { kind: 'text'; tone: 'info' | 'warning'; text: string }
  | { kind: 'enrollment_disabled' }
  | { kind: 'rate_limited'; seconds: number }
  | { kind: 'server'; error: unknown };

const CODE_TEXT: Partial<Record<ErrorCode, string>> = {
  authentication_failed: SIGN_IN_COPY.notEnrolled,
  challenge_expired: SIGN_IN_COPY.expired,
  challenge_invalid: SIGN_IN_COPY.expired,
  csrf: SIGN_IN_COPY.rejected,
  origin: SIGN_IN_COPY.rejected,
};

/** Classifies a sign-in or enrollment failure into its literal §6.3 sentence. */
export function signInProblem(error: unknown): SignInProblem {
  const failure = passkeyFailure(error);
  if (failure === 'canceled') return { kind: 'text', tone: 'info', text: SIGN_IN_COPY.canceled };
  if (failure !== null) return { kind: 'text', tone: 'warning', text: PASSKEY_FAILURE_MESSAGE[failure] };
  // The contract does not fix the status of a refused ceremony; a 401 still carries its code.
  const code = errorCode(error);
  if (code === null) return { kind: 'server', error };
  if (code === 'enrollment_unavailable') return { kind: 'enrollment_disabled' };
  if (code === 'rate_limited' && error instanceof ApiError && error.retryAfterSeconds !== null) {
    return { kind: 'rate_limited', seconds: error.retryAfterSeconds };
  }
  const text = CODE_TEXT[code];
  return text ? { kind: 'text', tone: 'warning', text } : { kind: 'server', error };
}
