import { afterEach, describe, expect, it, vi } from 'vitest';
import { NOSTR_KEYS, installNostrExtension, nostrChallenge, signedEvent } from '../../test/nostr';
import { closeRemoteSigner, connectRemoteSigner, getRemoteSigner, parseBunkerURI, type RemoteClientFactory, type RemoteConnection } from './remote-signer';
import { chooseSigner, disconnectRemoteSigner, saveRemoteSigner, signer, signerState } from './signer';
import { hasNostrSigner, NOSTR_SIGNER_STORAGE_KEY } from './signer-state';
import { NOSTR_FAILURE_MESSAGE, REMOTE_SIGNER_TIMEOUT_MS } from './signer-errors';
import { signNostrEvent } from './nostr';

const URI = `bunker://${NOSTR_KEYS[0].pubkey}?relay=wss%3A%2F%2Frelay.invalid&secret=synthetic-only`;
const BUNKER = { pubkey: NOSTR_KEYS[0].pubkey, relays: ['wss://relay.invalid'], secret: 'synthetic-only' };
const CONNECTION: RemoteConnection = { clientKey: Array(32).fill(1), bunker: BUNKER };
const TEMPLATE = nostrChallenge('login').event;

function transport() {
  const client = {
    bp: BUNKER,
    connect: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    getPublicKey: vi.fn(async () => NOSTR_KEYS[0].pubkey),
    signEvent: vi.fn(async (): Promise<unknown> => signedEvent(TEMPLATE)),
  };
  const factory: RemoteClientFactory = { fromBunker: vi.fn(() => client), fromURI: vi.fn(async () => client) };
  return { client, factory };
}

afterEach(async () => { await closeRemoteSigner(); });

describe('NIP-46 remote signer', () => {
  it('parses a bunker pointer with relays and a secret', async () => {
    await expect(parseBunkerURI(URI)).resolves.toEqual(BUNKER);
  });

  it.each(['', 'operator@example.invalid', 'https://example.invalid', 'bunker://bad?relay=wss://relay.invalid', `bunker://${BUNKER.pubkey}`, `bunker://${BUNKER.pubkey}?relay=https://relay.invalid`, `bunker://${BUNKER.pubkey}?relay=wss://user:password@relay.invalid`])('rejects a malformed or unsafe bunker URI: %s', async (uri) => {
    await expect(parseBunkerURI(uri)).rejects.toMatchObject({ failure: 'uri' });
  });

  it('connects with an injected client, persists client material and signs only the supplied template', async () => {
    const { client, factory } = transport();
    const connection = await connectRemoteSigner(URI, {}, factory);
    expect(connection.clientKey).toHaveLength(32);
    saveRemoteSigner(connection);
    await expect(signer.getPublicKey()).resolves.toBe(NOSTR_KEYS[0].pubkey);
    await expect(signer.signEvent(TEMPLATE)).resolves.toEqual(signedEvent(TEMPLATE));
    expect(client.signEvent).toHaveBeenCalledExactlyOnceWith(TEMPLATE);
    expect(JSON.parse(localStorage.getItem(NOSTR_SIGNER_STORAGE_KEY)!)).toEqual({ choice: 'remote', remote: connection });
  });

  it('switches to the extension without deleting remote state, and disconnect clears the choice', async () => {
    installNostrExtension();
    const { factory } = transport();
    const connection = await connectRemoteSigner(URI, {}, factory);
    saveRemoteSigner(connection);
    chooseSigner('extension');
    expect(signerState()).toEqual({ choice: 'extension', remote: connection });
    await expect(signer.signEvent(TEMPLATE)).resolves.toEqual(signedEvent(TEMPLATE));
    disconnectRemoteSigner();
    expect(localStorage.getItem(NOSTR_SIGNER_STORAGE_KEY)).toBeNull();
  });

  it('does not fall back to an installed extension when remote configuration is absent', async () => {
    const extension = installNostrExtension();
    chooseSigner('remote');
    expect(hasNostrSigner()).toBe(false);
    await expect(signer.signEvent(TEMPLATE)).rejects.toMatchObject({ failure: 'unconfigured' });
    expect(extension).not.toHaveBeenCalled();
  });

  it('restores the persisted client key and bunker pointer with the injected transport', async () => {
    const { factory } = transport();
    saveRemoteSigner(CONNECTION);
    const restored = signerState().remote;
    expect(restored).toEqual(CONNECTION);
    const remote = await getRemoteSigner(restored!, factory);
    await expect(remote.signEvent(TEMPLATE)).resolves.toEqual(signedEvent(TEMPLATE));
    expect(factory.fromBunker).toHaveBeenCalledExactlyOnceWith(new Uint8Array(CONNECTION.clientKey), BUNKER);
  });

  it('rejects corrupt persisted client material without contacting a relay', async () => {
    const { factory } = transport();
    await expect(getRemoteSigner({ ...CONNECTION, clientKey: Array(32).fill(0) }, factory)).rejects.toMatchObject({ failure: 'unconfigured' });
    expect(factory.fromBunker).not.toHaveBeenCalled();
  });

  it('rejects a remote answer that changes the server template', async () => {
    const { client, factory } = transport();
    saveRemoteSigner(await connectRemoteSigner(URI, {}, factory));
    client.signEvent.mockResolvedValue({ ...signedEvent(TEMPLATE), content: 'changed' });
    await expect(signNostrEvent(TEMPLATE)).rejects.toMatchObject({ failure: 'remote_malformed' });
  });

  it('does not close a replacement connection when an older request fails', async () => {
    const previous = transport();
    const remote = await getRemoteSigner(CONNECTION, previous.factory);
    let rejectPrevious: (error: unknown) => void = () => {};
    previous.client.signEvent.mockImplementation(() => new Promise((_, reject) => { rejectPrevious = reject; }));
    const pending = remote.signEvent(TEMPLATE);
    const rejected = expect(pending).rejects.toMatchObject({ failure: 'rejected' });
    const replacement = transport();
    const current = await getRemoteSigner({ ...CONNECTION, clientKey: Array(32).fill(2) }, replacement.factory);
    rejectPrevious('User rejected');
    await rejected;
    await expect(current.signEvent(TEMPLATE)).resolves.toEqual(signedEvent(TEMPLATE));
    expect(replacement.client.close).not.toHaveBeenCalled();
  });

  it.each([
    ['unreachable', new AggregateError([], 'No relay'), 'Relay unreachable.'],
    ['unreachable', new Error('subscription closed before connection was established.'), 'Relay unreachable.'],
    ['rejected', 'User rejected', 'Nostr signature canceled. Nothing was sent.'],
    ['remote_malformed', new SyntaxError('Invalid JSON'), 'Invalid remote response.'],
  ] as const)('maps %s to its literal message and closes the transport', async (failure, error, message) => {
    const { client, factory } = transport();
    const remote = await getRemoteSigner(CONNECTION, factory);
    client.signEvent.mockRejectedValue(error);
    await expect(remote.signEvent(TEMPLATE)).rejects.toMatchObject({ failure });
    expect(NOSTR_FAILURE_MESSAGE[failure]).toBe(message);
    expect(client.close).toHaveBeenCalledOnce();
  });

  it('times out after the named 30-second allowance and closes the transport', async () => {
    const { client, factory } = transport();
    const remote = await getRemoteSigner(CONNECTION, factory);
    vi.useFakeTimers();
    client.signEvent.mockImplementation(() => new Promise(() => {}));
    const rejected = expect(remote.signEvent(TEMPLATE)).rejects.toMatchObject({ failure: 'timeout' });
    await vi.advanceTimersByTimeAsync(REMOTE_SIGNER_TIMEOUT_MS);
    await rejected;
    expect(client.close).toHaveBeenCalledOnce();
    expect(NOSTR_FAILURE_MESSAGE.timeout).toBe('Remote signer timeout (30 seconds).');
  });

  it('mints a nostrconnect QR on the bunker relays and accepts the paired signer', async () => {
    const { factory } = transport();
    const onURI = vi.fn();
    await connectRemoteSigner(URI, { onURI }, factory);
    const uri = new URL(onURI.mock.calls[0][0]);
    expect(uri.protocol).toBe('nostrconnect:');
    expect(uri.searchParams.getAll('relay')).toEqual(BUNKER.relays);
    expect(uri.searchParams.get('perms')).toBe('sign_event:27235');
    expect(factory.fromURI).toHaveBeenCalledOnce();
  });

  it('cancels a pending connection and closes the transport', async () => {
    const { client, factory } = transport();
    client.connect.mockImplementation(() => new Promise(() => {}));
    const abort = new AbortController();
    const pending = connectRemoteSigner(URI, { signal: abort.signal }, factory);
    const rejected = expect(pending).rejects.toMatchObject({ failure: 'rejected' });
    await vi.waitFor(() => expect(client.connect).toHaveBeenCalledOnce());
    abort.abort();
    await rejected;
    expect(client.close).toHaveBeenCalledOnce();
  });
});
