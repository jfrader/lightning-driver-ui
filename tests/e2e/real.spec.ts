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
const NODE_REST = 'Polar LND REST';

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

function cln(...args: string[]) {
  return compose(
    'cln',
    'lightning-cli',
    '--lightning-dir=/home/clightning/.lightning',
    '--network=regtest',
    ...args,
  );
}

function mine(blocks = 6) {
  bitcoin('generatetoaddress', String(blocks), bitcoin('getnewaddress'));
}

function lnd(...args: string[]) {
  return compose('lnd', 'lncli', '--lnddir=/home/lnd/.lnd', '--network=regtest', ...args);
}

/** Both ends must consider the channel usable; CLN alone does not see LND's activation. */
async function waitForLndChannel(peer: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const channels = JSON.parse(lnd('listchannels')).channels ?? [];
    if (channels.some((c: { remote_pubkey: string; active: boolean }) => c.remote_pubkey === peer && c.active)) return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('LND never reported the channel active');
}

/** CLN must see the peer connected and the channel in CHANNELD_NORMAL before xpay can route. */
async function waitForClnChannel(peer: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const channels = JSON.parse(cln('listpeerchannels')).channels ?? [];
    if (channels.some((c: { peer_id: string; state: string; peer_connected: boolean }) => c.peer_id === peer && c.state === 'CHANNELD_NORMAL' && c.peer_connected)) return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('CLN channel never became routable');
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

/** The channel list is a node read; wait until the node reports the channel before closing it. */
async function waitForChannelOnNode(page: Page, node: string, channelId: string) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const found = await page.evaluate(
      async ({ node, channelId }) => {
        const response = await fetch(`/api/v1/nodes/${node}/channels?limit=100`);
        const body = await response.json();
        return (body.items ?? []).some((channel: { id: string }) => channel.id === channelId);
      },
      { node, channelId },
    );
    if (found) return;
    await page.waitForTimeout(2000);
  }
  throw new Error(`${node} never listed channel ${channelId}`);
}

async function mineUntil(page: Page, node: string, kind: string, wanted: string) {
  let latest = await latestOperation(page, node, kind);
  // Reconciliation spaces reads out (5 s doubling), and a channel needs the peer to
  // exchange channel_ready after the funding confirms; allow both to happen.
  for (let attempt = 0; attempt < 12; attempt += 1) {
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
  test.setTimeout(900_000);
  expect(TOKEN).toMatch(/^[0-9a-f]{64}$/);
  expect(LND).toMatch(/^[0-9a-f]{66}$/);
  expect(CLN).toMatch(/^[0-9a-f]{66}$/);

  // Collected after the least-privilege refusals, whose 4xx responses are expected.
  const problems: string[] = [];

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

  // Least-privilege credentials: reads answer, every mutation is refused before dispatch.
  const csrf = (await page.evaluate(() => fetch('/api/v1/session').then((response) => response.json())))
    .csrf_token as string;
  const attempt = (node: string, body: unknown) =>
    page.evaluate(
      async ({ node, body, csrf }) => {
        const response = await fetch(`/api/v1/nodes/${node}/operations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'Idempotency-Key': crypto.randomUUID() },
          body: JSON.stringify(body),
        });
        return { status: response.status, body: await response.json() };
      },
      { node, body, csrf },
    );
  const invoiceRequest = (amount: string) => ({
    kind: 'create_invoice',
    params: { amount_msat: amount, description: 'refused before dispatch', expiry_seconds: 3600 },
  });
  const count = (node: string) =>
    page.evaluate(async (node) => (await fetch(`/api/v1/nodes/${node}/operations`).then((r) => r.json())).items.length, node);

  for (const node of ['lnd-readonly', 'cln-readonly']) {
    for (const resource of ['info', 'balances', 'invoices', 'payments', 'peers', 'channels', 'transactions']) {
      const status = await page.evaluate(
        async ({ node, resource }) => (await fetch(`/api/v1/nodes/${node}/${resource}`)).status,
        { node, resource },
      );
      expect(status, `${node}/${resource} reads with a read-only credential`).toBe(200);
    }
    const denied = await attempt(node, invoiceRequest('1000'));
    expect(denied.body.error?.code, `${node} refuses the mutation`).toBe('node_auth_error');
    expect(await count(node), `${node} created no operation`).toBe(0);
  }

  const locked = await attempt('lnd-locked', invoiceRequest('1000'));
  expect(locked.body.error?.code, 'a read-only node refuses before any RPC').toBe('read_only');
  expect(await count('lnd-locked')).toBe(0);

  const overAmount = await attempt('lnd-grpc', invoiceRequest('9007199254740993'));
  expect(overAmount.body.error?.code, 'policy bounds refuse before dispatch').toBe('policy_violation');
  const disallowedPeer = await attempt('lnd-grpc', {
    kind: 'connect_peer',
    params: { pubkey: CLN!, host: 'not-allowed.example.invalid', port: 9735 },
  });
  expect(disallowedPeer.body.error?.code, 'peer allowlists refuse before dispatch').toBe('policy_violation');

  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`page: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);
  });

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

  await waitForChannelOnNode(page, 'lnd-grpc', channelId);
  await page.goto(`/nodes/lnd-grpc/channels/${encodeURIComponent(channelId)}/close`);
  await page.getByLabel('Fee rate (sat/vB)').fill('2');
  await page.getByRole('button', { name: 'Review close', exact: true }).click();
  await page.getByRole('button', { name: 'Close channel with Nostr', exact: true }).click();
  await mineUntil(page, 'lnd-grpc', 'close_channel', 'succeeded');

  // Real CLN mutations: fundchannel, xpay and close through the CLN adapter.
  await switchNode(page, NODE_CLN);
  await page.getByRole('link', { name: 'Channels', exact: true }).click();
  await page.getByRole('link', { name: /^Open channel/ }).first().click();
  await page.getByLabel('Peer public key').fill(LND!);
  await page.getByRole('textbox', { name: 'Channel size (sat)' }).fill('1000000');
  await page.getByRole('radio', { name: 'Private', exact: true }).click();
  await page.getByLabel('Fee rate (sat/vB)').fill('2');
  await page.getByRole('button', { name: 'Review channel open', exact: true }).click();
  await page.getByRole('button', { name: 'Open channel with Nostr', exact: true }).click();
  const clnOpened = await mineUntil(page, 'cln', 'open_channel', 'succeeded');
  expect(clnOpened.result.channel_id).toBeTruthy();
  const clnChannel = clnOpened.result.channel_id;


  // Real LND REST mutations through the same adapter seam.
  await switchNode(page, NODE_REST);
  await page.getByRole('link', { name: 'On-chain', exact: true }).click();
  await page.getByRole('link', { name: 'New address', exact: true }).click();
  await page.getByRole('button', { name: 'Review new address', exact: true }).click();
  await page.getByRole('button', { name: 'New address', exact: true }).click();
  const addressOp = await mineUntil(page, 'lnd-rest', 'new_address', 'succeeded');
  expect(addressOp.result.address).toMatch(/^bcrt1/);

  const restAddress = bitcoin('getnewaddress');
  await switchNode(page, NODE_REST);
  await page.getByRole('link', { name: 'On-chain', exact: true }).click();
  await page.getByRole('link', { name: 'Send on-chain', exact: true }).click();
  await page.getByLabel(/^Address/).fill(restAddress);
  await page.getByRole('textbox', { name: 'Amount (sat)' }).fill('10000');
  await page.getByLabel('Fee rate (sat/vB)').fill('2');
  await page.getByRole('button', { name: 'Review send', exact: true }).click();
  await page.getByRole('button', { name: 'Send with Nostr', exact: true }).click();
  const sent = await mineUntil(page, 'lnd-rest', 'send_onchain', 'succeeded');
  expect(sent.result.txid).toMatch(/^[0-9a-f]{64}$/);

  await page.goto(`/nodes/lnd-rest/peers?selected=${CLN}`);
  await page.getByRole('button', { name: 'Disconnect peer…' }).click();
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await mineUntil(page, 'lnd-rest', 'disconnect_peer', 'succeeded');

  await switchNode(page, NODE_REST);
  await page.getByRole('link', { name: 'Peers', exact: true }).click();
  await page.getByRole('link', { name: 'Connect peer', exact: true }).click();
  await page.getByLabel('Node public key').fill(`${CLN}@cln:9735`);
  await page.getByRole('button', { name: 'Review connection', exact: true }).click();
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await mineUntil(page, 'lnd-rest', 'connect_peer', 'succeeded');

  await switchNode(page, NODE_REST);
  await page.getByRole('link', { name: 'Channels', exact: true }).click();
  await page.getByRole('link', { name: /^Open channel/ }).first().click();
  await page.getByLabel('Peer public key').fill(CLN!);
  await page.getByRole('textbox', { name: 'Channel size (sat)' }).fill('1000000');
  await page.getByRole('radio', { name: 'Private', exact: true }).click();
  await page.getByLabel('Fee rate (sat/vB)').fill('2');
  await page.getByRole('button', { name: 'Review channel open', exact: true }).click();
  await page.getByRole('button', { name: 'Open channel with Nostr', exact: true }).click();
  const restOpened = await mineUntil(page, 'lnd-rest', 'open_channel', 'succeeded');
  expect(restOpened.result.channel_id).toBeTruthy();
  const restChannel = restOpened.result.channel_id;

  const restInvoice = JSON.parse(cln('invoice', '2000000msat', 'rest-pay', 'paid by LND REST')).bolt11;
  await switchNode(page, NODE_REST);
  await page.getByRole('link', { name: 'Payments', exact: true }).click();
  await page.getByRole('link', { name: 'Pay invoice', exact: true }).click();
  await page.getByLabel(/^Invoice/).fill(restInvoice);
  await page.getByRole('button', { name: 'Check invoice', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Review payment', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Review payment', exact: true }).click();
  await page.getByRole('button', { name: 'Pay with Nostr', exact: true }).click();
  await expect(page.getByText(/Paid|Settled/).first()).toBeVisible({ timeout: 60_000 });

  await waitForChannelOnNode(page, 'lnd-rest', restChannel);
  await page.goto(`/nodes/lnd-rest/channels/${encodeURIComponent(restChannel)}/close`);
  await page.getByLabel('Fee rate (sat/vB)').fill('2');
  await page.getByRole('button', { name: 'Review close', exact: true }).click();
  await page.getByRole('button', { name: 'Close channel with Nostr', exact: true }).click();
  await mineUntil(page, 'lnd-rest', 'close_channel', 'succeeded');

  // CLN's channeld can die mid-run on a loaded host; the node then reports the payment as
  // failed while the operation honestly stays unknown. A fresh invoice is a new operation.
  const payFromCln = async () => {
    const bolt11 = JSON.parse(lnd('addinvoice', '--amt=2000', '--memo=cln xpay'))
      .payment_request as string;
    await switchNode(page, NODE_CLN);
    await page.getByRole('link', { name: 'Payments', exact: true }).click();
    await page.getByRole('link', { name: 'Pay invoice', exact: true }).click();
    await page.getByLabel(/^Invoice/).fill(bolt11);
    await page.getByRole('button', { name: 'Check invoice', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Review payment', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Review payment', exact: true }).click();
    await page.getByRole('button', { name: 'Pay with Nostr', exact: true }).click();
    await page.waitForTimeout(3000);
    return latestOperation(page, 'cln', 'pay_invoice');
  };

  cln('connect', `${LND}@lnd:9735`);
  await waitForClnChannel(LND!);
  await waitForLndChannel(CLN!);
  cln('getroute', LND!, '2000000msat', '0');
  await page.waitForTimeout(3000);

  let clnPaid = await payFromCln();
  if (clnPaid?.state !== 'succeeded') {
    await page.waitForTimeout(15_000);
    cln('connect', `${LND}@lnd:9735`);
    await waitForClnChannel(LND!);
    clnPaid = await payFromCln();
  }
  expect(clnPaid?.state, 'CLN xpay reached a terminal outcome').toBe('succeeded');

  // A cooperative close needs the peer online; a dropped link makes CLN force the
  // commitment instead, which then stays onchain until its CSV delay matures.
  cln('connect', `${LND}@lnd:9735`);
  await waitForClnChannel(LND!);
  await waitForLndChannel(CLN!);
  await waitForChannelOnNode(page, 'cln', clnChannel);
  await page.goto(`/nodes/cln/channels/${encodeURIComponent(clnChannel)}/close`);
  await page.getByLabel('Fee rate (sat/vB)').fill('2');
  await page.getByRole('button', { name: 'Review close', exact: true }).click();
  await page.getByRole('button', { name: 'Close channel with Nostr', exact: true }).click();
  // CLN 25.09 keeps a cooperatively closed channel in `listpeerchannels` (ONCHAIN, no close
  // cause) and never lists it in `listclosedchannels`, so the adapter cannot observe the
  // known close type the contract needs. The close is accepted and broadcast; the operation
  // stays pending, which is the honest projection.
  const closed = await mineUntil(page, 'cln', 'close_channel', 'pending');
  expect(closed.stage).toBe('broadcast');

  expect(problems).toEqual([]);
});
