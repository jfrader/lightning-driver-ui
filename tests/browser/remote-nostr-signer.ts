import type { Page } from '@playwright/test';
import { decrypt, encrypt, getConversationKey } from 'nostr-tools/nip44';
import { finalizeEvent, getPublicKey, type EventTemplate, type VerifiedEvent } from 'nostr-tools/pure';

const BUNKER_KEY = new Uint8Array(32).fill(3);
const OPERATOR_KEY = new Uint8Array(32).fill(1);
const RELAY = 'wss://nip46.synthetic.invalid/';
export const BUNKER_URI = `bunker://${getPublicKey(BUNKER_KEY)}?relay=${encodeURIComponent(RELAY)}&secret=synthetic-only`;

/** A fake relay transport around the real NIP-46 client; no WebSocket reaches a network. */
export async function installRemoteNostrSigner(page: Page, options: { malformed?: boolean; reject?: boolean; silent?: boolean; pairingSecret?: string } = {}) {
  const signed: EventTemplate[] = [];
  await page.routeWebSocket(RELAY, (socket) => {
    const subscriptions = new Set<string>();
    socket.onMessage((message) => {
      const [type, id, payload] = JSON.parse(String(message));
      if (type === 'REQ') {
        subscriptions.add(id);
        socket.send(JSON.stringify(['EOSE', id]));
        if (options.pairingSecret && !payload.authors) {
          const clientKey: string = payload['#p'][0];
          const event = finalizeEvent({
            kind: 24133, created_at: Math.floor(Date.now() / 1000), tags: [['p', clientKey]],
            content: encrypt(options.malformed ? '{' : JSON.stringify({ id: 'pair', result: options.pairingSecret }), getConversationKey(BUNKER_KEY, clientKey)),
          }, BUNKER_KEY);
          socket.send(JSON.stringify(['EVENT', id, event]));
        }
      }
      if (type === 'CLOSE') subscriptions.delete(id);
      if (type !== 'EVENT') return;
      const event: VerifiedEvent = id;
      const key = getConversationKey(BUNKER_KEY, event.pubkey);
      const request: { id: string; method: string; params: string[] } = JSON.parse(decrypt(event.content, key));
      if (options.silent) return;
      let result = 'ack';
      if (request.method === 'get_public_key') result = getPublicKey(OPERATOR_KEY);
      if (request.method === 'sign_event') {
        const template: EventTemplate = JSON.parse(request.params[0]);
        signed.push(structuredClone(template));
        result = JSON.stringify(finalizeEvent(template, OPERATOR_KEY));
      }
      socket.send(JSON.stringify(['OK', event.id, true, '']));
      const response = finalizeEvent({
        kind: 24133,
        created_at: event.created_at,
        tags: [['p', event.pubkey]],
        content: encrypt(options.malformed ? '{' : JSON.stringify({ id: request.id, result, ...(options.reject ? { error: 'User rejected' } : {}) }), key),
      }, BUNKER_KEY);
      for (const subscription of subscriptions) socket.send(JSON.stringify(['EVENT', subscription, response]));
    });
  });
  return signed;
}
