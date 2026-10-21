import {
  WebAuthnAbortService,
  WebAuthnError,
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  type AuthenticationExtensionsClientInputs,
  type PublicKeyCredentialDescriptorJSON,
} from '@simplewebauthn/browser';
import { ApiError, ContractError, SessionEndedError, TransportError } from '../../api/errors';
import type {
  AuthenticationChallenge,
  AuthenticationCredential,
  RegistrationChallenge,
  RegistrationCredential,
} from '../../api/types';

const CANCELED_ERROR_NAMES: ReadonlySet<string> = new Set(['NotAllowedError', 'AbortError']);

// Extension semantics belong to the browser and the server library; the client only forwards them.
function isExtensionInputs(value: unknown): value is AuthenticationExtensionsClientInputs {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function descriptor(credential: { id: string; transports?: string[] }): PublicKeyCredentialDescriptorJSON {
  return { id: credential.id, type: 'public-key', transports: credential.transports };
}

/**
 * Runs a user-verified passkey assertion for server-issued options. Aborting `signal` cancels an
 * open browser prompt through the helper's abort service.
 */
export async function requestPasskeyAssertion(
  options: AuthenticationChallenge['options'],
  signal?: AbortSignal,
): Promise<AuthenticationCredential> {
  const { challenge, rpId, timeout, allowCredentials, userVerification, extensions } = options.publicKey;
  const cancelPrompt = () => WebAuthnAbortService.cancelCeremony();
  signal?.addEventListener('abort', cancelPrompt, { once: true });
  const result = await startAuthentication({
    optionsJSON: {
      challenge,
      rpId,
      timeout,
      userVerification,
      allowCredentials: allowCredentials?.map(descriptor),
      extensions: isExtensionInputs(extensions) ? extensions : undefined,
    },
  }).finally(() => signal?.removeEventListener('abort', cancelPrompt));
  return {
    id: result.id,
    rawId: result.rawId,
    type: result.type,
    authenticatorAttachment: result.authenticatorAttachment ?? null,
    response: { ...result.response },
    clientExtensionResults: { ...result.clientExtensionResults },
  };
}

/** Creates a passkey for server-issued registration options. */
export async function requestPasskeyRegistration(
  options: RegistrationChallenge['options'],
): Promise<RegistrationCredential> {
  const { publicKey } = options;
  const result = await startRegistration({
    optionsJSON: {
      challenge: publicKey.challenge,
      rp: { id: publicKey.rp.id, name: publicKey.rp.name },
      user: { id: publicKey.user.id, name: publicKey.user.name, displayName: publicKey.user.displayName },
      pubKeyCredParams: publicKey.pubKeyCredParams.map(({ alg }) => ({ type: 'public-key', alg })),
      excludeCredentials: publicKey.excludeCredentials?.map(descriptor),
      authenticatorSelection: publicKey.authenticatorSelection,
      attestation: publicKey.attestation,
      timeout: publicKey.timeout,
      extensions: isExtensionInputs(publicKey.extensions) ? publicKey.extensions : undefined,
    },
  });
  return {
    id: result.id,
    rawId: result.rawId,
    type: result.type,
    authenticatorAttachment: result.authenticatorAttachment ?? null,
    response: { ...result.response },
    clientExtensionResults: { ...result.clientExtensionResults },
  };
}

export type PasskeyFailure = 'canceled' | 'unsupported' | 'failed';

/** Classifies a browser passkey error. A canceled prompt is not an operation failure. */
export function passkeyFailure(error: unknown): PasskeyFailure | null {
  if (
    error instanceof ApiError ||
    error instanceof SessionEndedError ||
    error instanceof TransportError ||
    error instanceof ContractError
  ) {
    return null;
  }
  if (error instanceof WebAuthnError && error.code === 'ERROR_CEREMONY_ABORTED') return 'canceled';
  const cause = error instanceof WebAuthnError ? error.cause : error;
  if (CANCELED_ERROR_NAMES.has(errorName(cause))) return 'canceled';
  if (error instanceof WebAuthnError || error instanceof DOMException) return 'failed';
  return browserSupportsWebAuthn() ? null : 'unsupported';
}

function errorName(value: unknown): string {
  return typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string'
    ? value.name
    : '';
}

export const PASSKEY_FAILURE_MESSAGE: Record<PasskeyFailure, string> = {
  canceled: 'Passkey request canceled. Nothing was sent.',
  unsupported: 'This browser cannot use passkeys. Open the app in a browser with passkey support.',
  failed: 'This device could not complete the passkey request. Try again or use another passkey.',
};
