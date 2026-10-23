import type { Page } from '@playwright/test';
import { fixture, installSyntheticApi } from './synthetic-api';

export interface MonitoringOptions {
  offline?: boolean;
  syncing?: boolean;
  mismatch?: boolean;
  denied?: boolean;
  empty?: boolean;
  error?: boolean;
  long?: boolean;
  truncated?: boolean;
  restricted?: boolean;
}

export async function installMonitoringApi(page: Page, options: MonitoringOptions = {}) {
  const mutations = await installSyntheticApi(page);
  const bitcoin = fixture('node_bitcoin');
  const lnd = fixture('node_lnd');
  const enabled = { enabled: true, reason: null };
  const towerAvailability = options.denied ? { enabled: false, reason: 'permission_denied' } : enabled;
  const restrictedReads = options.restricted
    ? {
        payments: { enabled: false, reason: 'permission_denied' },
        operations: { enabled: false, reason: 'permission_denied' },
      }
    : {};
  const nodes = [
    {
      ...bitcoin,
      status: { ...bitcoin.status, status: options.offline ? 'offline' : 'online', synced_to_chain: !options.syncing },
    },
    {
      ...lnd,
      read_availability: {
        ...lnd.read_availability,
        ...restrictedReads,
        watchtower_client: towerAvailability,
        watchtower_server: towerAvailability,
      },
    },
  ];
  await page.route('**/api/v1/nodes', (route) =>
    route.fulfill({ json: { ...fixture('nodes_page'), items: nodes, next_cursor: null, truncated: false } }),
  );
  await page.route('**/api/v1/nodes/*', (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1);
    const node = nodes.find((node) => node.id === id);
    return node ? route.fulfill({ json: node }) : route.fallback();
  });
  await page.route('**/api/v1/nodes/*/bitcoin**', (route) => {
    if (options.error)
      return route.fulfill({
        status: 503,
        json: {
          error: {
            code: 'node_offline',
            message: 'Node is offline.',
            request_id: '00000000-0000-4000-8000-0000000009fd',
            operation_id: null,
            outcome: 'not_applicable',
          },
        },
      });
    if (new URL(route.request().url()).pathname.endsWith('/peers')) {
      const peers = fixture('bitcoin_peers_page');
      if (options.empty) peers.items = [];
      if (options.long && peers.items[0]) peers.items[0].addr = `${'a'.repeat(56)}.onion:48333`;
      return route.fulfill({ json: peers });
    }
    const info = fixture('bitcoin_info');
    return route.fulfill({
      json: {
        ...info,
        network: options.mismatch ? 'mainnet' : info.network,
        initial_block_download: Boolean(options.syncing),
        verification_progress_bp: options.syncing ? '2345' : info.verification_progress_bp,
        warnings: options.long ? ['Warning: disk space is low. Free disk space before the next block download.'] : [],
      },
    });
  });
  await page.route('**/api/v1/nodes/*/watchtower/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (options.error)
      return route.fulfill({
        status: 503,
        json: {
          error: {
            code: 'node_offline',
            message: 'Node is offline.',
            request_id: '00000000-0000-4000-8000-0000000009fd',
            operation_id: null,
            outcome: 'not_applicable',
          },
        },
      });
    if (path.endsWith('/server')) {
      const server = fixture('watchtower_server');
      return route.fulfill({
        json: { ...server, listeners: options.empty ? [] : server.listeners, uris: options.empty ? [] : server.uris },
      });
    }
    if (path.endsWith('/towers')) {
      const towers = fixture('watchtower_towers_page');
      return route.fulfill({ json: { ...towers, items: options.empty ? [] : towers.items } });
    }
    if (path.includes('/towers/')) {
      const tower = fixture('watchtower_tower_detail');
      return route.fulfill({
        json: {
          ...tower,
          session_info: tower.session_info.map((info) => ({ ...info, sessions_truncated: Boolean(options.truncated) })),
        },
      });
    }
    return route.fulfill({ json: fixture('watchtower_client') });
  });
  return mutations;
}
