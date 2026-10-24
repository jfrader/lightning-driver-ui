import { ApiError, errorCode } from '../../api/errors';
import type { AuthMethod, ErrorCode } from '../../api/types';
import { formatSeconds } from '../../lib/duration';
import { NOSTR_FAILURE_MESSAGE, hasNostrExtension, nostrFailure } from './nostr';
import { PASSKEY_FAILURE_MESSAGE, passkeyFailure } from './passkey';

/** Host command that issues an enrollment token. Recovery has no frozen command, so none is printed (G-9). */
export const ENROLLMENT_COMMAND = 'api-server auth enrollment --config <path>';

/** Screens spec §6.3. Login drops the reviews' `Nothing was sent.`: nothing can be sent from here. */
export const SIGN_IN_COPY = {
  enrollmentExpired: 'The enrollment request expired. Start again.',
  enrollmentRefused: 'The server refused this enrollment. Check the token.',
  rejected: 'Sign-in was rejected by the server. Reload this page.',
  enrollmentDisabled: 'Enrollment is not available.',
  noMethod: 'No sign-in method is enrolled.',
} as const;

/** The sentences that name the sign-in method, and what this browser lacks to use it. */
export const METHOD_COPY: Record<AuthMethod, { canceled: string; notEnrolled: string; expired: string; unsupported: string }> = {
  passkey: {
    canceled: 'Passkey request canceled.',
    notEnrolled: 'This passkey is not enrolled on this server.',
    expired: 'The sign-in request expired. Continue with passkey again.',
    unsupported: PASSKEY_FAILURE_MESSAGE.unsupported,
  },
  nostr: {
    canceled: 'Nostr signature canceled.',
    notEnrolled: 'This Nostr key is not enrolled on this server.',
    expired: 'The sign-in request expired. Sign in with Nostr again.',
    get unsupported() {
      return hasNostrExtension() ? NOSTR_FAILURE_MESSAGE.unconfigured : NOSTR_FAILURE_MESSAGE.missing;
    },
  },
};

export const rateLimitedText = (seconds: number) => `Too many attempts. Try again in ${formatSeconds(seconds)}.`;

export type SignInProblem =
  | { kind: 'text'; tone: 'info' | 'warning'; text: string }
  | { kind: 'enrollment_disabled' }
  | { kind: 'rate_limited'; seconds: number }
  | { kind: 'server'; error: unknown };

// Nostr first: without WebAuthn, the passkey classifier reads any other error as `unsupported`.
function signerProblem(error: unknown): SignInProblem | null {
  const nostr = nostrFailure(error);
  if (nostr === 'rejected') return { kind: 'text', tone: 'info', text: METHOD_COPY.nostr.canceled };
  if (nostr !== null) return { kind: 'text', tone: 'warning', text: NOSTR_FAILURE_MESSAGE[nostr] };
  const passkey = passkeyFailure(error);
  if (passkey === 'canceled') return { kind: 'text', tone: 'info', text: METHOD_COPY.passkey.canceled };
  if (passkey !== null) return { kind: 'text', tone: 'warning', text: PASSKEY_FAILURE_MESSAGE[passkey] };
  return null;
}

/** Classifies a sign-in or enrollment failure into its literal §6.3 sentence. */
export function signInProblem(error: unknown, method: AuthMethod): SignInProblem {
  const signer = signerProblem(error);
  if (signer) return signer;
  // The contract does not fix the status of a refused ceremony; a 401 still carries its code.
  const code = errorCode(error);
  if (code === null) return { kind: 'server', error };
  if (code === 'enrollment_unavailable') return { kind: 'enrollment_disabled' };
  if (code === 'rate_limited' && error instanceof ApiError && error.retryAfterSeconds !== null) {
    return { kind: 'rate_limited', seconds: error.retryAfterSeconds };
  }
  const codeText: Partial<Record<ErrorCode, string>> = {
    authentication_failed: METHOD_COPY[method].notEnrolled,
    challenge_expired: METHOD_COPY[method].expired,
    challenge_invalid: METHOD_COPY[method].expired,
    csrf: SIGN_IN_COPY.rejected,
    origin: SIGN_IN_COPY.rejected,
  };
  const text = codeText[code];
  return text ? { kind: 'text', tone: 'warning', text } : { kind: 'server', error };
}

/** Enrollment uses the sign-in sentences except where the wording names the wrong ceremony. */
export function signUpProblem(error: unknown, method: AuthMethod): SignInProblem {
  const code = errorCode(error);
  if (code === 'challenge_expired' || code === 'challenge_invalid') {
    return { kind: 'text', tone: 'warning', text: SIGN_IN_COPY.enrollmentExpired };
  }
  if (code === 'authentication_failed') return { kind: 'text', tone: 'warning', text: SIGN_IN_COPY.enrollmentRefused };
  return signInProblem(error, method);
}
