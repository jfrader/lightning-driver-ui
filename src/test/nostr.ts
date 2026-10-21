import { vi } from 'vitest';
import type { NostrChallenge, NostrEventTemplate, NostrIdentity, NostrStart } from '../api/types';

/**
 * Synthetic Nostr keys (secret keys 32×0x01 and 32×0x02) and contract-shaped challenges. The
 * signatures are placeholders; the MSW server does not verify them. Browser tests sign for real.
 */
export const NOSTR_KEYS = [
  {
    pubkey: '1b84c5567b126440995d3ed5aaba0565d71e1834604819ff9c17f5e9d5dd078f',
    npub: 'npub1rwzv24nmzfjypx2a8m264ws9vht3uxp5vpypnluuzl67n4waq78suk0wul',
  },
  {
    pubkey: '4d4b6cd1361032ca9bd2aeb9d900aa4d45d9ead80ac9423374c451a7254d0766',
    npub: 'npub1f49ke5fkzqev4x7j46uajq92f4zan6kcpty5yvm5c3g6wf2dqanqn7qsy2',
  },
] as const;

export const NOSTR_NONCE = 'c'.repeat(64);

export function nostrIdentity(index: 0 | 1 = 0): NostrIdentity {
  return { ...NOSTR_KEYS[index], label: null, created_at: '2026-10-21T11:00:00Z', last_used_at: null };
}

export function nostrIdentities(identities: NostrIdentity[], passkeyCount: number) {
  return { identities, passkey_count: passkeyCount };
}

/** The server's template for one purpose, with the operation binding when it has one. */
export function nostrChallenge(
  purpose: NostrStart['purpose'] | 'operation',
  binding: { operationId?: string; digest?: string; target?: string } = {},
): NostrChallenge {
  const tags = [
    ['u', 'https://manager.example.invalid/api/v1/auth/nostr/finish'],
    ['method', 'POST'],
    ['challenge', NOSTR_NONCE],
    ['purpose', purpose],
    ...(binding.operationId ? [['operation', binding.operationId]] : []),
    ...(binding.digest ? [['digest', binding.digest]] : []),
    ...(binding.target ? [['target', binding.target]] : []),
  ];
  return {
    challenge_id: '00000000-0000-4000-8000-000000000a01',
    nonce: NOSTR_NONCE,
    expires_at: '2026-10-21T12:02:00Z',
    url: 'https://manager.example.invalid/api/v1/auth/nostr/finish',
    event: { kind: 27235, created_at: 1792584000, tags, content: '' },
  };
}

export function signedEvent(template: NostrEventTemplate, index: 0 | 1 = 0) {
  return { ...template, pubkey: NOSTR_KEYS[index].pubkey, id: 'd'.repeat(64), sig: 'e'.repeat(128) };
}

/** Installs a NIP-07 `window.nostr` whose `signEvent` the test controls; `setup.ts` removes it. */
export function installNostrExtension(index: 0 | 1 = 0) {
  const signEvent = vi.fn(async (template: NostrEventTemplate): Promise<unknown> => signedEvent(template, index));
  window.nostr = { getPublicKey: async () => NOSTR_KEYS[index].pubkey, signEvent };
  return signEvent;
}
