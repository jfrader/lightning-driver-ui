import type { Mock } from 'vitest';

export interface WebauthnStubs {
  startAuthentication: Mock;
  startRegistration: Mock;
}

/** Module factory for `vi.mock('@simplewebauthn/browser', …)`: real errors, stubbed ceremonies. */
export async function webauthnModule(importOriginal: () => Promise<unknown>, stubs: WebauthnStubs) {
  const original = await importOriginal();
  return { ...(original as object), ...stubs, browserSupportsWebAuthn: () => true };
}

export const assertion = {
  id: 'c3ludGhldGljLWNyZWRlbnRpYWw',
  rawId: 'c3ludGhldGljLWNyZWRlbnRpYWw',
  type: 'public-key' as const,
  response: {
    clientDataJSON: 'c3ludGhldGljLWNsaWVudC1kYXRh',
    authenticatorData: 'c3ludGhldGljLWF1dGgtZGF0YQ',
    signature: 'c3ludGhldGljLXNpZ25hdHVyZQ',
  },
  clientExtensionResults: {},
};

export function canceledPasskey(): DOMException {
  return new DOMException('The operation either timed out or was not allowed.', 'NotAllowedError');
}
