import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { installNostrSigner } from '../browser/nostr-signer';

const TOKEN = process.env.E2E_TOKEN;
const LND = process.env.E2E_LND_PUBKEY;
const CLN = process.env.E2E_CLN_PUBKEY;
const PROJECT = process.env.E2E_PROJECT;
const COMPOSE = process.env.E2E_COMPOSE_FILE;
const DATA = process.env.E2E_DATA;
const NODE_CLN = 'Polar CLN';
const NODE_GRPC = 'Polar LND gRPC';

function compose(...args: string[]) {
  return execFileSync(
    'docker',
    ['compose', '-p', PROJECT!, '-f', COMPOSE!, 'exec', '-T', ...args],
    { encoding: 'utf8', env: { ...process.env, E2E_DATA: DATA } },
  ).trim();
}

function bitcoin(...args: string[]) {
  return compose(
    'bitcoind',
    'bitcoin-cli',
    '-regtest',
    '-rpcuser=polar',
    '-rpcpassword=polar',
    '-rpcwallet=e2e',
    ...args,
  );
}

function mine(blocks = 6) {
  bitcoin('generatetoaddress', String(blocks), bitcoin('getnewaddress'));
}

async function switchNode(page: Page, label: string) {
  const chooser = page.getByRole('combobox', { name: 'Node' });
  await chooser.click();
  await page.getByRole('option', { name: new RegExp(`^${label} ·`) }).click();
  await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
}

async function operation(page: Page, node: string, kind: string) {
  const result = await page.evaluate(
    async ({ node, kind }) => {
      const response = await fetch(`/api/v1/nodes/${node}/operations?kind=${kind}&limit=10`);
      const body = await response.json();
      return body.items.find((item: { state: string }) => item.state === 'succeeded') ?? null;
    },
    { node, kind },
  );
  return result as { id: string; result: Record<string, string> } | null;
}

async function latestOperation(page: Page, node: string, kind: string) {
  return (await page.evaluate(
    async ({ node, kind }) => {
      const response = await fetch(`/api/v1/nodes/${node}/operations?kind=${kind}&limit=10`);
      const body = await response.json();
      return body.items[0] ?? null;
    },
    { node, kind },
  )) as { id: string; state: string; stage: string; result: Record<string, string> } | null;
}

async function mineUntil(page: Page, node: string, kind: string, wanted: string) {
  let latest = await latestOperation(page, node, kind);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (latest?.state === wanted) return latest;
    await page.waitForTimeout(2500);
    mine(6);
    await page.waitForTimeout(2500);
    latest = await latestOperation(page, node, kind);
  }
  expect(latest?.state, `${kind} reached ${latest?.state}/${latest?.stage}`).toBe(wanted);
  return latest!;
}

test('real Polar regtest journey: reads, invoice, channel, payment, on-chain, close', async ({ page }) => {
  test.setTimeout(300_000);
  expect(TOKEN).toMatch(/^[0-9a-f]{64}$/);
  expect(LND).toMatch(/^[0-9a-f]{66}$/);
  expect(CLN).toMatch(/^[0-9a-f]{66}$/);

  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`page: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);
  });

  const signer = await installNostrSigner(page);

  await page.goto('/login');
  await page.getByLabel('Enrollment token').fill(TOKEN!);
  await page.getByRole('radio', { name: 'Nostr', exact: true }).click();
  await page.getByRole('button', { name: 'Sign with Nostr', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  const session = await page.evaluate(() => fetch('/api/v1/session').then((response) => response.json()));
  expect(session.auth_method).toBe('nostr');
  expect(signer).toHaveLength(1);

  // All three real transports answer every read route.
  for (const node of ['lnd-grpc', 'lnd-rest', 'cln']) {
    for (const resource of ['info', 'balances', 'invoices', 'payments', 'peers', 'channels', 'transactions', 'fee-estimates']) {
      const status = await page.evaluate(
        async ({ node, resource }) => (await fetch(`/api/v1/nodes/${node}/${resource}`)).status,
        { node, resource },
      );
      expect(status, `${node}/${resource}`).toBe(200);
    }
  }

  await switchNode(page, NODE_CLN);
  await page.getByRole('link', { name: 'Invoices', exact: true }).click();
  await page.getByRole('link', { name: 'Create invoice', exact: true }).click();
  await page.getByRole('textbox', { name: 'Amount (sat)' }).fill('1500');
  await page.getByLabel('Description', { exact: true }).fill('real Polar e2e invoice');
  await page.getByRole('button', { name: 'Review invoice', exact: true }).click();
  await page.getByRole('button', { name: 'Create invoice', exact: true }).click();
  await expect(page.getByText('Invoice created', { exact: true }).first()).toBeVisible();
  const invoice = await operation(page, 'cln', 'create_invoice');
  expect(invoice?.result.bolt11).toMatch(/^lnbcrt/);
  const bolt11 = invoice!.result.bolt11;

  await switchNode(page, NODE_GRPC);
  await page.getByRole('link', { name: 'Channels', exact: true }).click();
  await page.getByRole('link', { name: /^Open channel/ }).first().click();
  await page.getByLabel('Peer public key').fill(CLN!);
  await page.getByRole('textbox', { name: 'Channel size (sat)' }).fill('1000000');
  await page.getByRole('radio', { name: 'Private', exact: true }).click();
  await page.getByLabel('Fee rate (sat/vB)').fill('2');
  await page.getByRole('button', { name: 'Review channel open', exact: true }).click();
  await page.getByRole('button', { name: 'Open channel with Nostr', exact: true }).click();
  const opened = await mineUntil(page, 'lnd-grpc', 'open_channel', 'succeeded');
  expect(opened.result.channel_id).toBeTruthy();
  const channelId = opened.result.channel_id;

  await switchNode(page, NODE_GRPC);
  await page.getByRole('link', { name: 'Payments', exact: true }).click();
  await page.getByRole('link', { name: 'Pay invoice', exact: true }).click();
  await page.getByLabel(/^Invoice/).fill(bolt11);
  await page.getByRole('button', { name: 'Check invoice', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Review payment', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Review payment', exact: true }).click();
  await page.getByRole('button', { name: 'Pay with Nostr', exact: true }).click();
  await expect(page.getByText(/Paid|Settled/).first()).toBeVisible({ timeout: 60_000 });

  const address = bitcoin('getnewaddress');
  await switchNode(page, NODE_GRPC);
  await page.getByRole('link', { name: 'On-chain', exact: true }).click();
  await page.getByRole('link', { name: 'Send on-chain', exact: true }).click();
  await page.getByLabel(/^Address/).fill(address);
  await page.getByRole('textbox', { name: 'Amount (sat)' }).fill('10000');
  await page.getByLabel('Fee rate (sat/vB)').fill('2');
  await page.getByRole('button', { name: 'Review send', exact: true }).click();
  await page.getByRole('button', { name: 'Send with Nostr', exact: true }).click();
  await expect(page.getByText(/Broadcast|Sent to node/).first()).toBeVisible({ timeout: 60_000 });

  await page.goto(`/nodes/lnd-grpc/channels/${encodeURIComponent(channelId)}/close`);
  await page.getByLabel('Fee rate (sat/vB)').fill('2');
  await page.getByRole('button', { name: 'Review close', exact: true }).click();
  await page.getByRole('button', { name: 'Close channel with Nostr', exact: true }).click();
  await mineUntil(page, 'lnd-grpc', 'close_channel', 'succeeded');

  expect(problems).toEqual([]);
});
