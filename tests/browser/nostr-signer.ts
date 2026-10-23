import type { Page } from '@playwright/test';
import { npubEncode } from 'nostr-tools/nip19';
import { finalizeEvent, getPublicKey, verifyEvent, type EventTemplate, type VerifiedEvent } from 'nostr-tools/pure';

/** Synthetic operator key (32×0x01); never a real identity. */
const SECRET_KEY = new Uint8Array(32).fill(1);
export const SYNTHETIC_NOSTR_PUBKEY = getPublicKey(SECRET_KEY);
export const SYNTHETIC_NPUB = npubEncode(SYNTHETIC_NOSTR_PUBKEY);

const SIGN_BINDING = '__syntheticNostrSign';

/**
 * Gives the page a NIP-07 `window.nostr` before any app script runs. Events are signed in Node
 * with the synthetic key; the page never holds it.
 */
export async function installNostrSigner(page: Page): Promise<EventTemplate[]> {
  const signed: EventTemplate[] = [];
  await page.exposeFunction(SIGN_BINDING, (template: EventTemplate): VerifiedEvent => {
    signed.push(template);
    return finalizeEvent(template, SECRET_KEY);
  });
  await page.addInitScript(
    ({ pubkey, binding }) => {
      const sign = Reflect.get(window, binding);
      Object.defineProperty(window, 'nostr', {
        configurable: true,
        value: { getPublicKey: async () => pubkey, signEvent: (template: unknown) => sign(template) },
      });
    },
    { pubkey: SYNTHETIC_NOSTR_PUBKEY, binding: SIGN_BINDING },
  );
  return signed;
}

/** A real NIP-01 check: id, BIP-340 signature, synthetic key, and the issued template unchanged. */
export function isSignedTemplate(event: unknown, template: EventTemplate): boolean {
  if (typeof event !== 'object' || event === null) return false;
  const candidate = {
    kind: Reflect.get(event, 'kind'),
    created_at: Reflect.get(event, 'created_at'),
    tags: Reflect.get(event, 'tags'),
    content: Reflect.get(event, 'content'),
    pubkey: Reflect.get(event, 'pubkey'),
    id: Reflect.get(event, 'id'),
    sig: Reflect.get(event, 'sig'),
  };
  return (
    verifyEvent(candidate) &&
    candidate.pubkey === SYNTHETIC_NOSTR_PUBKEY &&
    candidate.kind === template.kind &&
    candidate.created_at === template.created_at &&
    candidate.content === template.content &&
    JSON.stringify(candidate.tags) === JSON.stringify(template.tags)
  );
}
