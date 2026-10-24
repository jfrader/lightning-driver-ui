import { useSyncExternalStore } from 'react';
import { hasNostrSigner, subscribeSigner } from './signer-state';

export function useNostrSigner() {
  return useSyncExternalStore(subscribeSigner, hasNostrSigner);
}
