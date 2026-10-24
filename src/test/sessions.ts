import type { ActiveSession } from '../api/types';

export const currentSession: ActiveSession = {
  id: '00000000-0000-4000-8000-000000000101',
  method: 'passkey',
  created_at: '2026-10-21T12:00:00Z',
  expires_at: '2026-10-22T12:00:00Z',
  idle_expires_at: '2026-10-21T13:00:00Z',
  last_authenticated_at: '2026-10-21T12:00:00Z',
  nostr_pubkey: null,
  current: true,
};

export const otherSession: ActiveSession = {
  ...currentSession,
  id: '00000000-0000-4000-8000-000000000102',
  method: 'nostr',
  created_at: '2026-10-21T11:00:00Z',
  nostr_pubkey: 'a'.repeat(64),
  current: false,
};
