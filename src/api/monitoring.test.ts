import { QueryClient } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { fixture } from '../test/fixtures';
import { api, server } from '../test/server';
import { ContractError } from './errors';
import { BitcoinNodeInfo, NodeSummary } from './generated/validators';
import {
  bitcoinPeersQueryOptions,
  bitcoinQueryOptions,
  watchtowerClientQueryOptions,
  watchtowerServerQueryOptions,
  watchtowerTowerQueryOptions,
  watchtowerTowersQueryOptions,
} from './monitoring';

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });

describe('monitoring API boundary', () => {
  it('validates all six frozen monitoring reads', async () => {
    const queries = client();
    expect(await queries.fetchQuery(bitcoinQueryOptions('bitcoin-lab'))).toEqual(fixture('bitcoin_info'));
    expect(await queries.fetchQuery(bitcoinPeersQueryOptions('bitcoin-lab'))).toEqual(fixture('bitcoin_peers_page'));
    expect(await queries.fetchQuery(watchtowerServerQueryOptions('lnd-lab'))).toEqual(fixture('watchtower_server'));
    expect(await queries.fetchQuery(watchtowerClientQueryOptions('lnd-lab'))).toEqual(fixture('watchtower_client'));
    expect(await queries.fetchQuery(watchtowerTowersQueryOptions('lnd-lab'))).toEqual(
      fixture('watchtower_towers_page'),
    );
    const tower = fixture('watchtower_tower_detail');
    expect(await queries.fetchQuery(watchtowerTowerQueryOptions('lnd-lab', tower.pubkey))).toEqual(tower);
    queries.clear();
  });

  it('rejects a monitoring observation for another node or a detail for another tower', async () => {
    server.use(
      http.get(api('/nodes/:nodeId/bitcoin'), () =>
        HttpResponse.json({ ...fixture('bitcoin_info'), node_id: 'another-node' }),
      ),
    );
    const queries = client();
    await expect(queries.fetchQuery(bitcoinQueryOptions('bitcoin-lab'))).rejects.toBeInstanceOf(ContractError);
    const otherKey = `03${'2'.repeat(64)}`;
    await expect(queries.fetchQuery(watchtowerTowerQueryOptions('lnd-lab', otherKey))).rejects.toBeInstanceOf(
      ContractError,
    );
    queries.clear();
  });

  it('requires complete support availability and rejects health as a support reason', () => {
    const node = fixture('node_bitcoin');
    expect(NodeSummary(node)).toBe(true);
    expect(NodeSummary({ ...node, read_availability: { bitcoin: { enabled: true, reason: null } } })).toBe(false);
    expect(
      NodeSummary({
        ...node,
        read_availability: { ...node.read_availability, bitcoin: { enabled: false, reason: 'node_offline' } },
      }),
    ).toBe(false);
  });

  it('rejects out-of-range progress and imprecise JSON numbers before rendering', () => {
    const info = fixture('bitcoin_info');
    expect(BitcoinNodeInfo({ ...info, verification_progress_bp: '10001' })).toBe(false);
    expect(BitcoinNodeInfo({ ...info, size_on_disk: Number.MAX_SAFE_INTEGER + 1 })).toBe(false);
  });
});
