import { WebAuthnError } from '@simplewebauthn/browser';
import { describe, expect, it } from 'vitest';
import { ApiError, SessionEndedError, TransportError } from '../../api/errors';
import type { ErrorCode } from '../../api/types';
import { NostrSignerError } from './nostr';
import { rateLimitedText, signInProblem, signUpProblem } from './sign-in-problem';

const apiError = (code: ErrorCode, retryAfter: number | null = null, status = 400) =>
  new ApiError(status, { code, message: `server says ${code}`, request_id: '00000000-0000-4000-8000-000000000999', operation_id: null, outcome: 'not_applicable' }, retryAfter);

describe('sign-in problems (screens spec §6.3)', () => {
  it('reads a canceled prompt without "Nothing was sent."', () => {
    expect(signInProblem(new DOMException('No', 'NotAllowedError'), 'passkey')).toEqual({
      kind: 'text',
      tone: 'info',
      text: 'Passkey request canceled.',
    });
  });

  it('reads a device failure literally', () => {
    const failure = new WebAuthnError({ message: 'x', code: 'ERROR_AUTHENTICATOR_GENERAL_ERROR', cause: new DOMException('x', 'InvalidStateError') });
    expect(signInProblem(failure, 'passkey')).toEqual({
      kind: 'text',
      tone: 'warning',
      text: 'This device could not complete the passkey request. Try again or use another passkey.',
    });
  });

  it.each([
    ['authentication_failed', 'This passkey is not enrolled on this server.'],
    ['challenge_expired', 'The sign-in request expired. Continue with passkey again.'],
    ['challenge_invalid', 'The sign-in request expired. Continue with passkey again.'],
    ['csrf', 'Sign-in was rejected by the server. Reload this page.'],
    ['origin', 'Sign-in was rejected by the server. Reload this page.'],
  ] as const)('passkey %s → %s', (code, text) => {
    expect(signInProblem(apiError(code), 'passkey')).toEqual({ kind: 'text', tone: 'warning', text });
  });

  it.each([
    ['authentication_failed', 'This Nostr key is not enrolled on this server.'],
    ['challenge_expired', 'The sign-in request expired. Sign in with Nostr again.'],
    ['challenge_invalid', 'The sign-in request expired. Sign in with Nostr again.'],
    ['csrf', 'Sign-in was rejected by the server. Reload this page.'],
  ] as const)('Nostr %s → %s', (code, text) => {
    expect(signInProblem(apiError(code), 'nostr')).toEqual({ kind: 'text', tone: 'warning', text });
  });

  it.each([
    ['missing', 'warning', 'No Nostr extension found.'],
    ['rejected', 'info', 'Nostr signature canceled.'],
    ['malformed', 'warning', 'The Nostr extension returned an invalid signature.'],
  ] as const)('reads a Nostr extension that is %s literally', (failure, tone, text) => {
    expect(signInProblem(new NostrSignerError(failure), 'nostr')).toEqual({ kind: 'text', tone, text });
  });

  it('keeps the sentence when the refusal comes back as a 401', () => {
    const refusal = new SessionEndedError(apiError('authentication_failed').detail, null);
    expect(signInProblem(refusal, 'passkey')).toEqual({ kind: 'text', tone: 'warning', text: 'This passkey is not enrolled on this server.' });
  });

  it('names the enrollment ceremony when its request expired', () => {
    expect(signUpProblem(apiError('challenge_expired'), 'passkey')).toEqual({
      kind: 'text',
      tone: 'warning',
      text: 'The enrollment request expired. Start again.',
    });
  });

  it('reads a refused enrollment as a token problem, not an unknown key', () => {
    expect(signUpProblem(apiError('authentication_failed'), 'nostr')).toEqual({
      kind: 'text',
      tone: 'warning',
      text: 'The server refused this enrollment. Check the token.',
    });
  });

  it('reads enrollment_unavailable as the host-only wording', () => {
    expect(signInProblem(apiError('enrollment_unavailable', null, 403), 'passkey')).toEqual({ kind: 'enrollment_disabled' });
  });

  it('holds a rate limit for its Retry-After, and falls back to the server text without one', () => {
    expect(signInProblem(apiError('rate_limited', 30, 429), 'nostr')).toEqual({ kind: 'rate_limited', seconds: 30 });
    expect(rateLimitedText(30)).toBe('Too many attempts. Try again in 30 seconds.');
    expect(rateLimitedText(1)).toBe('Too many attempts. Try again in 1 second.');
    expect(signInProblem(apiError('rate_limited', null, 429), 'passkey').kind).toBe('server');
  });

  it('leaves anything unlisted to the error block', () => {
    expect(signInProblem(apiError('internal_error', null, 500), 'passkey').kind).toBe('server');
    expect(signInProblem(new TransportError('network'), 'nostr').kind).toBe('server');
  });
});
