import { BunkerSigner, createNostrConnectURI, parseBunkerInput, type BunkerPointer } from 'nostr-tools/nip46';
import { generateSecretKey, getPublicKey, type Event } from 'nostr-tools/pure';
import { decrypt, getConversationKey } from 'nostr-tools/nip44';
import { SimplePool } from 'nostr-tools/pool';
import type { NostrSigner } from './signer';
import { NostrSignerError, REMOTE_SIGNER_TIMEOUT_MS } from './signer-errors';

export interface RemoteConnection {
  clientKey: number[];
  bunker: BunkerPointer;
}
export interface RemoteClient extends NostrSigner {
  connect: () => Promise<void>;
  close: () => Promise<void>;
  bp: BunkerPointer;
}
export interface RemoteClientFactory {
  fromBunker: (key: Uint8Array, bunker: BunkerPointer) => RemoteClient;
  fromURI: (key: Uint8Array, uri: string, signal: AbortSignal) => Promise<RemoteClient>;
}

class SignerRelayPool extends SimplePool {
  readonly onMalformed: () => void;
  readonly beforeEvent: (event: Event) => void;
  constructor(onMalformed: () => void, beforeEvent: (event: Event) => void) {
    super();
    this.onMalformed = onMalformed;
    this.beforeEvent = beforeEvent;
  }
  override subscribe(...[relays, filter, params]: Parameters<SimplePool['subscribe']>) {
    return super.subscribe(relays, filter, {
      ...params,
      onevent: (event) => {
        void Promise.resolve().then(() => {
          this.beforeEvent(event);
          return params.onevent?.(event);
        }).catch(this.onMalformed);
      },
    });
  }

  async shutdown() {
    for (const relay of this.relays.values()) {
      for (const subscription of [...relay.openSubs.values()]) subscription.close();
    }
    await Promise.resolve();
    this.destroy();
  }
}

function clientFactory(): RemoteClientFactory {
  let rejectAuth: (error: NostrSignerError) => void;
  let pairingKey: Uint8Array | undefined;
  const authFailure = new Promise<never>((_, reject) => { rejectAuth = reject; });
  const pool = new SignerRelayPool(
    () => rejectAuth(new NostrSignerError('remote_malformed')),
    (event) => {
      if (pairingKey) JSON.parse(decrypt(event.content, getConversationKey(pairingKey, event.pubkey)));
    },
  );
  const wrap = (client: BunkerSigner): RemoteClient => ({
    bp: client.bp,
    connect: () => Promise.race([client.connect(), authFailure]),
    getPublicKey: () => Promise.race([client.getPublicKey(), authFailure]),
    signEvent: (template) => Promise.race([client.signEvent(template), authFailure]),
    close: async () => {
      await client.close();
      await pool.shutdown();
    },
  });
  const params = { pool, onauth: () => rejectAuth(new NostrSignerError('rejected')), skipSwitchRelays: true };
  return {
    fromBunker: (key, bunker) => wrap(BunkerSigner.fromBunker(key, bunker, params)),
    fromURI: async (key, uri, signal) => {
      pairingKey = key;
      try {
        return wrap(await Promise.race([BunkerSigner.fromURI(key, uri, params, signal), authFailure]));
      } catch (error) {
        await pool.shutdown();
        throw error;
      } finally { pairingKey = undefined; }
    },
  };
}

export async function parseBunkerURI(input: string): Promise<BunkerPointer> {
  try {
    const url = new URL(input.trim());
    if (
      url.protocol !== 'bunker:' || !/^[a-f0-9]{64}$/.test(url.hostname) ||
      url.username || url.password || url.port || url.hash || (url.pathname && url.pathname !== '/')
    ) throw new NostrSignerError('uri');
    const bunker = await parseBunkerInput(url.href);
    if (!bunker) throw new NostrSignerError('uri');
    return checkedBunker(bunker);
  } catch { throw new NostrSignerError('uri'); }
}

function checkedBunker(bunker: BunkerPointer): BunkerPointer {
  if (
    !bunker || !/^[a-f0-9]{64}$/.test(bunker.pubkey) ||
    !Array.isArray(bunker.relays) || bunker.relays.length === 0 ||
    (bunker.secret !== null && typeof bunker.secret !== 'string')
  ) throw new NostrSignerError('uri');
  for (const relay of bunker.relays) {
    const address = new URL(relay);
    if (address.protocol !== 'wss:' || address.username || address.password || address.hash) throw new NostrSignerError('uri');
  }
  return bunker;
}

function checkedClientKey(value: RemoteConnection): Uint8Array {
  if (
    !value || !Array.isArray(value.clientKey) || value.clientKey.length !== 32 ||
    !value.clientKey.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
  ) throw new NostrSignerError('unconfigured');
  const key = new Uint8Array(value.clientKey);
  try {
    getPublicKey(key);
  } catch {
    throw new NostrSignerError('unconfigured');
  }
  return key;
}

export function remoteFailure(error: unknown): NostrSignerError {
  if (error instanceof NostrSignerError) return error;
  if (
    error instanceof AggregateError || error instanceof TypeError ||
    (error instanceof Error && error.message === 'subscription closed before connection was established.')
  ) return new NostrSignerError('unreachable');
  if (
    error instanceof SyntaxError ||
    (error instanceof Error && error.message.startsWith('event returned from bunker is improperly signed:'))
  ) return new NostrSignerError('remote_malformed');
  return new NostrSignerError('rejected');
}

async function remoteRequest<T>(request: () => Promise<T>, close: () => Promise<void>, signal?: AbortSignal): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const abort = () => rejectAbort(new NostrSignerError('rejected'));
  let rejectAbort: (error: NostrSignerError) => void;
  const canceled = new Promise<never>((_, reject) => { rejectAbort = reject; });
  signal?.addEventListener('abort', abort, { once: true });
  try {
    if (signal?.aborted) throw new NostrSignerError('rejected');
    return await Promise.race([
      request(),
      canceled,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new NostrSignerError('timeout')), REMOTE_SIGNER_TIMEOUT_MS); }),
    ]);
  } catch (error) {
    await close();
    throw remoteFailure(error);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

let active: { connection: string; client: RemoteClient } | undefined;

export async function closeRemoteSigner(connection?: RemoteConnection) {
  const previous = active;
  if (connection && previous?.connection !== JSON.stringify(connection)) return;
  active = undefined;
  await previous?.client.close();
}

async function retireClient(client: RemoteClient) {
  if (active?.client === client) active = undefined;
  await client.close();
}

export async function connectRemoteSigner(
  input: string,
  options: { onURI?: (uri: string) => void; signal?: AbortSignal } = {},
  factory?: RemoteClientFactory,
): Promise<RemoteConnection> {
  const bunker = await parseBunkerURI(input);
  await closeRemoteSigner();
  const key = generateSecretKey();
  const clients = factory ?? clientFactory();
  const abort = new AbortController();
  options.signal?.addEventListener('abort', () => abort.abort(), { once: true, signal: abort.signal });
  let client: RemoteClient | undefined;
  try {
    const connection = await remoteRequest(async () => {
      if (options.onURI) {
        const uri = createNostrConnectURI({
          clientPubkey: getPublicKey(key), relays: bunker.relays,
          secret: crypto.randomUUID(), name: 'Lightning Driver', perms: ['sign_event:27235'],
        });
        options.onURI(uri);
        client = await clients.fromURI(key, uri, abort.signal);
      } else {
        try { client = clients.fromBunker(key, bunker); }
        catch { throw new NostrSignerError('uri'); }
        await client.connect();
      }
      if (!/^[a-f0-9]{64}$/.test(await client.getPublicKey())) throw new NostrSignerError('remote_malformed');
      return { clientKey: Array.from(key), bunker: client.bp };
    }, async () => { abort.abort(); await client?.close(); }, options.signal);
    if (abort.signal.aborted) {
      await client?.close();
      throw new NostrSignerError('rejected');
    }
    active = { connection: JSON.stringify(connection), client: client! };
    return connection;
  } finally { abort.abort(); }
}

export async function getRemoteSigner(connection: RemoteConnection, factory?: RemoteClientFactory): Promise<NostrSigner> {
  const key = checkedClientKey(connection);
  let bunker: BunkerPointer;
  try { bunker = checkedBunker(connection.bunker); }
  catch { throw new NostrSignerError('unconfigured'); }
  const id = JSON.stringify(connection);
  if (active?.connection !== id) {
    await closeRemoteSigner();
    let client: RemoteClient;
    try { client = (factory ?? clientFactory()).fromBunker(key, bunker); }
    catch { throw new NostrSignerError('unconfigured'); }
    await remoteRequest(() => client.connect(), () => client.close());
    active = { connection: id, client };
  }
  const client = active.client;
  return {
    getPublicKey: () => remoteRequest(async () => {
      const key = await client.getPublicKey();
      if (!/^[a-f0-9]{64}$/.test(key)) throw new NostrSignerError('remote_malformed');
      return key;
    }, () => retireClient(client)),
    signEvent: (template) => remoteRequest(() => client.signEvent(template), () => retireClient(client)),
  };
}
