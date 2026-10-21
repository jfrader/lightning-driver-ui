import { describe, expect, it } from 'vitest';
import { installNostrExtension, nostrChallenge, signedEvent } from '../../test/nostr';
import { NostrSignerError, hasNostrExtension, signNostrEvent } from './nostr';

const template = nostrChallenge('login').event;

async function failure(promise: Promise<unknown>) {
  const error = await promise.catch((caught: unknown) => caught);
  if (!(error instanceof NostrSignerError)) throw new Error('expected a NostrSignerError');
  return error.failure;
}

describe('NIP-07 adapter', () => {
  it('detects an extension only when it can sign', () => {
    expect(hasNostrExtension()).toBe(false);
    // An object without signEvent, as a half-installed extension leaves it.
    Object.defineProperty(window, 'nostr', { value: { getPublicKey: async () => '' }, configurable: true, writable: true });
    expect(hasNostrExtension()).toBe(false);
    installNostrExtension();
    expect(hasNostrExtension()).toBe(true);
  });

  it('signs the server template and returns the signed event', async () => {
    const signEvent = installNostrExtension();
    await expect(signNostrEvent(template)).resolves.toEqual(signedEvent(template));
    expect(signEvent).toHaveBeenCalledWith(template);
  });

  it('keeps only the contract fields of the signed event', async () => {
    installNostrExtension().mockResolvedValue({ ...signedEvent(template), relays: ['wss://relay.invalid'] });
    await expect(signNostrEvent(template)).resolves.toEqual(signedEvent(template));
  });

  it('reports a missing extension without asking anything', async () => {
    expect(await failure(signNostrEvent(template))).toBe('missing');
  });

  it('reports a refused signature', async () => {
    installNostrExtension().mockRejectedValue(new Error('User rejected'));
    expect(await failure(signNostrEvent(template))).toBe('rejected');
  });

  it.each([
    ['nothing', undefined],
    ['a string', 'signed'],
    ['no signature', { ...signedEvent(template), sig: undefined }],
    ['a short signature', { ...signedEvent(template), sig: 'e'.repeat(64) }],
    ['other tags', { ...signedEvent(template), tags: [...template.tags.slice(0, 3), ['purpose', 'link']] }],
    ['another time', { ...signedEvent(template), created_at: template.created_at + 1 }],
    ['content', { ...signedEvent(template), content: 'hello' }],
  ])('reports a malformed answer: %s', async (_, answer) => {
    installNostrExtension().mockResolvedValue(answer);
    expect(await failure(signNostrEvent(template))).toBe('malformed');
  });
});
