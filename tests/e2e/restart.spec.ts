import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { installNostrSigner } from '../browser/nostr-signer';
import { composeCommand, enrollmentToken } from './harness';

const TRANSITION_TIMEOUT = 120_000;
const REQUEST_TIMEOUT = 35_000;
const POLL_INTERVAL = 1000;
const DAEMONS = [
  { service: 'bitcoind', nodes: ['bitcoind'] },
  { service: 'lnd', nodes: ['lnd-grpc', 'lnd-rest'] },
  { service: 'cln', nodes: ['cln'] },
];

async function read(page: Page, path: string) {
  const response = await page.request.get(`/api/v1/${path}`, { timeout: REQUEST_TIMEOUT });
  return { status: response.status(), body: await response.json() };
}

async function transition(page: Page, node: string, online: boolean) {
  let last;
  const deadline = Date.now() + TRANSITION_TIMEOUT;
  do {
    const status = await read(page, `nodes/${node}/status`);
    const info = await read(page, `nodes/${node}/info`);
    last = { status, info };
    const fresh = info.status === 200 && info.body.stale === false;
    if (online && status.status === 200 && status.body.status === 'online' && fresh) return last;
    const unavailable = (status.status === 200 &&
      (status.body.status === 'offline' || Boolean(status.body.error_code))) ||
      (status.status >= 500 && Boolean(status.body.error?.code));
    const honest = (info.status >= 500 && Boolean(info.body.error?.code)) ||
      (info.status === 200 && info.body.stale === true);
    if (!online && unavailable && honest) return last;
    await page.waitForTimeout(POLL_INTERVAL);
  } while (Date.now() < deadline);
  throw new Error(`${node}: ${online ? 'recovery' : 'outage'} transition timed out: ${JSON.stringify(last)}`);
}

test('regtest restart drill: honest outages, reconnect and journal continuity', async ({ page }, testInfo) => {
  test.setTimeout(900_000);
  await installNostrSigner(page);
  const token = enrollmentToken();
  await page.goto('/login');
  const enroll = page.getByRole('button', { name: 'Enroll a sign-in method', exact: true });
  await expect(enroll.or(page.getByLabel('Enrollment token'))).toBeVisible();
  if (await enroll.isVisible()) await enroll.click();
  await page.getByLabel('Enrollment token').fill(token);
  await page.getByRole('radio', { name: 'Nostr', exact: true }).click();
  await page.getByRole('button', { name: 'Sign with Nostr', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  const session = await read(page, 'session');
  expect(session.body.auth_method).toBe('nostr');
  const headers = { 'X-CSRF-Token': session.body.csrf_token, Origin: new URL(page.url()).origin };

  for (const { service, nodes } of DAEMONS) {
    await test.step(`${service}: baseline, stop, outage, start, recovery, journal`, async () => {
      for (const node of nodes) {
        await test.step(`${service}: baseline ${node}`, async () => { await transition(page, node, true); });
      }
      const operationNode = service === 'cln' ? 'cln' : 'lnd-grpc';
      const operations = `/api/v1/nodes/${operationNode}/operations`;
      const key = randomUUID();
      const data = { kind: 'create_invoice', params: {
        amount_msat: '1000', description: `restart drill ${service}`, expiry_seconds: 3600,
      } };
      const created = await page.request.post(operations, {
        headers: { ...headers, 'Idempotency-Key': key }, data,
      });
      expect(created.status(), `${service}: create invoice review`).toBe(201);
      const operation = await created.json();
      const operationPath = `${operations}/${operation.id}`;
      const outages: string[] = [];
      try {
        await test.step(`${service}: stop`, async () => { composeCommand('stop', service); });
        for (const node of nodes) {
          await test.step(`${service}: outage ${node}`, async () => {
            const { status, info } = await transition(page, node, false);
            outages.push(`${node}=${status.body.status ?? status.body.error?.code}, info=${info.status}/${info.body.stale === true ? 'stale' : info.body.error?.code}`);
          });
        }
        const journal = await page.request.get(operationPath);
        expect(journal.status(), `${service}: journal during outage`).toBe(200);
        expect((await journal.json()).id, `${service}: journal identity during outage`).toBe(operation.id);
      } finally {
        await test.step(`${service}: start`, async () => { composeCommand('start', service); });
      }
      for (const node of nodes) {
        await test.step(`${service}: recovery ${node}`, async () => { await transition(page, node, true); });
      }
      if (!nodes.includes(operationNode)) {
        await test.step(`${service}: dependent ${operationNode} recovery`, async () => { await transition(page, operationNode, true); });
      }
      const confirmed = await page.request.post(`${operationPath}/confirm`, {
        headers, data: { review_digest: operation.review.digest, authorization_id: null },
      });
      expect(confirmed.ok(), `${service}: confirm original invoice after recovery: ${await confirmed.text()}`).toBe(true);
      await expect.poll(async () => {
        const result = await page.request.get(operationPath);
        expect(result.status(), `${service}: journal read after recovery`).toBe(200);
        const body = await result.json();
        expect(body.id, `${service}: original journal id`).toBe(operation.id);
        return body.state;
      }, { timeout: TRANSITION_TIMEOUT, intervals: [POLL_INTERVAL], message: `${service}: invoice journal resolution` }).toBe('succeeded');
      const replay = await page.request.post(operations, {
        headers: { ...headers, 'Idempotency-Key': key }, data,
      });
      expect(replay.status(), `${service}: idempotent create replay`).toBe(200);
      expect((await replay.json()).id, `${service}: no duplicate operation`).toBe(operation.id);
      const list = await read(page, `nodes/${operationNode}/operations?kind=create_invoice&limit=100`);
      expect(list.status, `${service}: journal list`).toBe(200);
      expect(list.body.items.filter((item: { request: typeof data }) =>
        item.request?.params?.description === data.params.description), `${service}: unique invoice journal entry`).toHaveLength(1);
      const evidence = `${service}: ${outages.join('; ')}; ${nodes.join(', ')} online with fresh info; invoice ${operation.id} resolved once`;
      console.log(evidence);
      await testInfo.attach(service, { body: evidence, contentType: 'text/plain' });
    });
  }
});
