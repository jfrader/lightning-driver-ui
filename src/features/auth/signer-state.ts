import type { RemoteConnection } from './remote-signer';

export const NOSTR_SIGNER_STORAGE_KEY = 'lightning-driver.nostr';
export type SignerChoice = 'extension' | 'remote';
export interface SignerState { choice: SignerChoice; remote?: RemoteConnection }

export function signerSnapshot(): string | null {
  return localStorage.getItem(NOSTR_SIGNER_STORAGE_KEY);
}

export function subscribeSigner(listener: () => void): () => void {
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}

export function hasNostrExtension(): boolean { return typeof window.nostr?.signEvent === 'function'; }

export function hasNostrSigner(): boolean {
  const stored = signerSnapshot();
  if (stored === null) return hasNostrExtension();
  try {
    const value: SignerState = JSON.parse(stored);
    return value.choice === 'remote' ? !!value.remote : value.choice === 'extension' && hasNostrExtension();
  } catch { return false; }
}
