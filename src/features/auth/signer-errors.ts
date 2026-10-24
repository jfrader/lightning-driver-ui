export const REMOTE_SIGNER_TIMEOUT_MS = 30_000;
export type NostrFailure = 'missing' | 'rejected' | 'malformed' | 'remote_malformed' | 'unconfigured' | 'unreachable' | 'timeout' | 'uri';

export class NostrSignerError extends Error {
  readonly failure: NostrFailure;
  constructor(failure: NostrFailure) {
    super(`Nostr signer: ${failure}`);
    this.name = 'NostrSignerError';
    this.failure = failure;
  }
}

export const NOSTR_FAILURE_MESSAGE: Record<NostrFailure, string> = {
  missing: 'No Nostr extension found.',
  rejected: 'Nostr signature canceled. Nothing was sent.',
  malformed: 'The Nostr extension returned an invalid signature.',
  remote_malformed: 'Invalid remote response.',
  unconfigured: 'No signer configured.',
  unreachable: 'Relay unreachable.',
  timeout: 'Remote signer timeout (30 seconds).',
  uri: 'Invalid bunker:// URI.',
};
