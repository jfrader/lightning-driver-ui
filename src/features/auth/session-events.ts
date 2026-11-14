import type { QueryClient } from '@tanstack/react-query';
import { clearSessionCsrfToken } from '../../api/csrf';
import type { LoginNotice } from './login-state';
import { NOSTR_SIGNER_STORAGE_KEY } from './signer-state';

const SESSION_CHANNEL = 'lightning-driver.session';
const source = crypto.randomUUID();
export type SessionEvent = LoginNotice | 'session_changed';

export function clearSession(queryClient: QueryClient, preserveSigner = false) {
  clearSessionCsrfToken();
  queryClient.clear();
  if (!preserveSigner) {
    localStorage.removeItem(NOSTR_SIGNER_STORAGE_KEY);
    window.dispatchEvent(new Event('storage'));
  }
  void import('./remote-signer').then(({ closeRemoteSigner }) => closeRemoteSigner()).catch(() => undefined);
}

export function publishSessionEvent(event: SessionEvent) {
  if (!window.BroadcastChannel) return;
  const channel = new BroadcastChannel(SESSION_CHANNEL);
  channel.postMessage({ source, notice: event });
  channel.close();
}

export function subscribeSessionEvents(listener: (event: SessionEvent) => void) {
  if (!window.BroadcastChannel) return () => {};
  const channel = new BroadcastChannel(SESSION_CHANNEL);
  channel.onmessage = ({ data }: MessageEvent<unknown>) => {
    if (!data || typeof data !== 'object' || !('source' in data) || data.source === source || !('notice' in data)) return;
    const notice = data.notice;
    if (notice === 'signed_out' || notice === 'sign_out_failed' || notice === 'session_ended' || notice === 'session_changed') listener(notice);
  };
  return () => channel.close();
}
