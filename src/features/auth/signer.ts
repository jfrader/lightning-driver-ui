import { NostrEvent as isNostrEvent } from '../../api/generated/validators';
import type { NostrEvent, NostrEventTemplate } from '../../api/types';
import { NostrSignerError } from './signer-errors';
import type { RemoteConnection } from './remote-signer';
import { NOSTR_SIGNER_STORAGE_KEY, hasNostrExtension, signerSnapshot, type SignerChoice, type SignerState } from './signer-state';

export interface NostrSigner {
  getPublicKey: () => Promise<string>;
  signEvent: (event: NostrEventTemplate) => Promise<unknown>;
}

declare global {
  interface Window { nostr?: NostrSigner }
}

export function signerState(): SignerState {
  const stored = signerSnapshot();
  if (stored === null) return { choice: hasNostrExtension() ? 'extension' : 'remote' };
  try {
    const value: Partial<SignerState> | null = JSON.parse(stored);
    if (value?.choice === 'remote' || value?.choice === 'extension') return { choice: value.choice, remote: value.remote };
  } catch { /* Invalid storage stays unconfigured. */ }
  return { choice: 'remote' };
}

function store(state: SignerState | null) {
  // The remote client key and bunker secret in localStorage grant signer access; same-origin scripts can read them.
  if (state) localStorage.setItem(NOSTR_SIGNER_STORAGE_KEY, JSON.stringify(state));
  else localStorage.removeItem(NOSTR_SIGNER_STORAGE_KEY);
  window.dispatchEvent(new Event('storage'));
}

export function chooseSigner(choice: SignerChoice) {
  store({ ...signerState(), choice });
  if (choice === 'extension') void import('./remote-signer').then(({ closeRemoteSigner }) => closeRemoteSigner());
}

export function saveRemoteSigner(remote: RemoteConnection) { store({ choice: 'remote', remote }); }

export function disconnectRemoteSigner() {
  store(null);
  void import('./remote-signer').then(({ closeRemoteSigner }) => closeRemoteSigner());
}

async function activeSigner(): Promise<NostrSigner> {
  const state = signerState();
  if (state.choice === 'remote') {
    if (!state.remote) throw new NostrSignerError(signerSnapshot() !== null ? 'unconfigured' : 'missing');
    return (await import('./remote-signer')).getRemoteSigner(state.remote);
  }
  if (!hasNostrExtension()) throw new NostrSignerError('missing');
  const extension = window.nostr!;
  return {
    getPublicKey: async () => {
      try { return await extension.getPublicKey(); }
      catch { throw new NostrSignerError('rejected'); }
    },
    signEvent: async (event) => {
      try { return await extension.signEvent(event); }
      catch { throw new NostrSignerError('rejected'); }
    },
  };
}

export const signer: NostrSigner = {
  getPublicKey: async () => (await activeSigner()).getPublicKey(),
  signEvent: async (template) => (await activeSigner()).signEvent(template),
};

const EVENT_FIELDS = ['kind', 'created_at', 'tags', 'content', 'pubkey', 'id', 'sig'] as const satisfies readonly (keyof NostrEvent)[];

export async function signNostrEvent(template: NostrEventTemplate): Promise<NostrEvent> {
  const signed = await signer.signEvent(template);
  const malformed = () => new NostrSignerError(signerState().choice === 'remote' ? 'remote_malformed' : 'malformed');
  if (typeof signed !== 'object' || signed === null) throw malformed();
  const event: unknown = Object.fromEntries(EVENT_FIELDS.map((key) => [key, Reflect.get(signed, key)]));
  if (
    !isNostrEvent(event) || event.kind !== template.kind || event.created_at !== template.created_at ||
    event.content !== template.content || JSON.stringify(event.tags) !== JSON.stringify(template.tags)
  ) throw malformed();
  return event;
}
