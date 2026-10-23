import { NostrEvent as isNostrEvent } from '../../api/generated/validators';
import type { NostrEvent, NostrEventTemplate } from '../../api/types';

/** The NIP-07 signer a browser extension installs as `window.nostr`. */
interface Nip07Signer {
  getPublicKey: () => Promise<string>;
  signEvent: (event: NostrEventTemplate) => Promise<unknown>;
}

declare global {
  interface Window {
    nostr?: Nip07Signer;
  }
}

const EVENT_FIELDS = ['kind', 'created_at', 'tags', 'content', 'pubkey', 'id', 'sig'] as const satisfies readonly (keyof NostrEvent)[];

export type NostrFailure = 'missing' | 'rejected' | 'malformed';

/** A Nostr extension problem: absent, refused to sign, or answered with something unusable. */
export class NostrSignerError extends Error {
  readonly failure: NostrFailure;

  constructor(failure: NostrFailure) {
    super(`Nostr signer: ${failure}`);
    this.name = 'NostrSignerError';
    this.failure = failure;
  }
}

function signer(): Nip07Signer | null {
  const candidate = window.nostr;
  return typeof candidate?.signEvent === 'function' ? candidate : null;
}

export function hasNostrExtension(): boolean {
  return signer() !== null;
}

function sameTemplate(event: NostrEvent, template: NostrEventTemplate): boolean {
  return (
    event.kind === template.kind &&
    event.created_at === template.created_at &&
    event.content === template.content &&
    JSON.stringify(event.tags) === JSON.stringify(template.tags)
  );
}

/**
 * Asks the extension to sign the server's event template. Only the contract's event fields are
 * kept, and the signed event must carry the template unchanged.
 */
export async function signNostrEvent(template: NostrEventTemplate): Promise<NostrEvent> {
  const extension = signer();
  if (!extension) throw new NostrSignerError('missing');
  let signed: unknown;
  try {
    signed = await extension.signEvent(template);
  } catch {
    throw new NostrSignerError('rejected');
  }
  if (typeof signed !== 'object' || signed === null) throw new NostrSignerError('malformed');
  const event: unknown = Object.fromEntries(EVENT_FIELDS.map((key) => [key, Reflect.get(signed, key)]));
  if (!isNostrEvent(event) || !sameTemplate(event, template)) throw new NostrSignerError('malformed');
  return event;
}

export function nostrFailure(error: unknown): NostrFailure | null {
  return error instanceof NostrSignerError ? error.failure : null;
}

export const NOSTR_FAILURE_MESSAGE: Record<NostrFailure, string> = {
  missing: 'No Nostr extension found.',
  rejected: 'Nostr signature canceled. Nothing was sent.',
  malformed: 'The Nostr extension returned an invalid signature.',
};
