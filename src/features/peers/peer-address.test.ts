import { describe, expect, it } from 'vitest';
import { peerChoiceLabel, shortPubkey } from './peer-address';

const PUBKEY = '034444444444444444444444444444444444444444444444444444444444444444';

describe('peer labels', () => {
  it('keeps the head and tail of a key', () => {
    expect(shortPubkey(PUBKEY)).toBe('0344444444…444444');
  });

  it('names the address and the connection state', () => {
    expect(peerChoiceLabel({ pubkey: PUBKEY, address: '203.0.113.7:9735', connected: true })).toBe(
      '0344444444…444444 · 203.0.113.7:9735',
    );
    expect(peerChoiceLabel({ pubkey: PUBKEY, address: null, connected: false })).toBe(
      '0344444444…444444 · address not reported · Not connected',
    );
  });
});
