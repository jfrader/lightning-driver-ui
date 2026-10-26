import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from './synthetic-api';
import { installMonitoringApi } from './monitoring-api';

const root = '/nodes/lnd-lab';
const resources = [
  { title: 'Payments', path: `${root}/payments`, selected: fixture('payments_page').items[0].payment_hash, actionCount: 1 },
  { title: 'Invoices', path: `${root}/invoices`, selected: fixture('invoices_page').items[0].payment_hash, actionCount: 1 },
  { title: 'Channels', path: `${root}/channels`, selected: fixture('channels_page').items[0].id, actionCount: 1 },
  { title: 'Peers', path: `${root}/peers`, selected: fixture('peers_page').items[0].pubkey, actionCount: 1 },
  { title: 'On-chain', path: `${root}/onchain`, selected: fixture('transactions_page').items[0].txid, list: 'Transactions', actionCount: 2 },
];
const screens = [
  ...resources.flatMap(screen => [
    { ...screen, state: 'closed' },
    { ...screen, path: `${screen.path}?selected=${encodeURIComponent(screen.selected)}`, state: 'inspector' },
  ]),
  { title: 'Fleet', path: '/fleet', state: 'default', list: 'Nodes' },
  { title: 'More', path: '/more', state: 'default', list: null },
  { title: 'Operations', path: `${root}/operations`, state: 'default', list: 'Operations' },
  { title: 'Watchtower client', path: `${root}/watchtower`, state: 'default', list: null },
  { title: 'Watchtower server', path: `${root}/watchtower/server`, state: 'default', list: null },
  { title: 'Peers', path: '/nodes/bitcoin-lab/peers', state: 'bitcoin', list: 'Bitcoin peers' },
  { title: 'Peers', path: '/nodes/bitcoin-lab/peers?selected=1', state: 'bitcoin-inspector', list: 'Bitcoin peers' },
];

for (const width of [390, 1440]) {
  test(`@layout page headers share the list edge and title/action centre at ${width}`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await installMonitoringApi(page);
    await page.setViewportSize({ width, height: 1000 });
    const measurements = [];
    const evidence = process.env.HEADER_EVIDENCE_DIR;
    if (evidence) await mkdir(evidence, { recursive: true });
    for (const screen of screens) {
      await page.goto(screen.path);
      const title = page.getByRole('heading', { name: screen.title, exact: true });
      await expect(title).toBeVisible();
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => document.fonts.ready);
      const listName = screen.list === undefined ? screen.title : screen.list;
      const content = listName
        ? page.getByRole(width < 768 ? 'list' : 'table', { name: listName, exact: true })
        : title.locator('..').locator('..').locator(':scope > :nth-child(2)');
      await expect(content).toBeVisible();
      const contentRight = await content.evaluate(element => {
        let right = element.getBoundingClientRect().right;
        for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
          if (['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(ancestor).overflowX)) {
            right = Math.min(right, ancestor.getBoundingClientRect().right);
          }
        }
        return right;
      });
      const geometry = await title.evaluate(element => {
        const rect = (target: Element) => {
          const box = target.getBoundingClientRect();
          return { top: box.top, bottom: box.bottom, height: box.height, width: box.width, left: box.left, right: box.right, centre: (box.top + box.bottom) / 2 };
        };
        const header = element.parentElement!;
        const cluster = element.nextElementSibling;
        return {
          title: rect(element), header: rect(header),
          cluster: cluster ? rect(cluster) : null,
          controls: cluster ? [...cluster.querySelectorAll('button, a')].map(control => ({ name: control.textContent?.trim(), ...rect(control) })) : [],
        };
      });
      const label = `${screen.title} ${screen.state} ${width}`;
      expect.soft(geometry.controls, `${label}: expected header actions`).toHaveLength('actionCount' in screen ? screen.actionCount ?? 0 : 0);
      const row = { ...screen, name: screen.title, width, contentRight, ...geometry,
        edgeDelta: geometry.cluster ? geometry.cluster.right - contentRight : geometry.header.right - contentRight,
        centreDelta: geometry.cluster ? geometry.cluster.centre - geometry.title.centre : null,
      };
      measurements.push(row);
      expect.soft(Math.abs(row.edgeDelta), `${label}: action/header edge vs content`).toBeLessThanOrEqual(1);
      if (row.centreDelta !== null) {
        expect.soft(Math.abs(row.centreDelta), `${label}: title/action centre`).toBeLessThanOrEqual(1);
        expect.soft(geometry.title.right, `${label}: title/action separation`).toBeLessThanOrEqual(geometry.cluster!.left);
        const actionRight = Math.max(...geometry.controls.map(control => control.right));
        expect.soft(Math.abs(actionRight - contentRight), `${label}: rightmost control edge`).toBeLessThanOrEqual(1);
        if (width === 390) {
          for (const control of geometry.controls) {
            expect.soft(Math.abs(control.right - contentRight), `${label}: wrapped ${control.name} edge`).toBeLessThanOrEqual(1);
            expect.soft(control.height, `${label}: ${control.name} touch height`).toBeGreaterThanOrEqual(44);
            expect.soft(control.width, `${label}: ${control.name} touch width`).toBeGreaterThanOrEqual(44);
          }
        } else {
          for (const control of geometry.controls) {
            expect.soft(Math.abs(control.centre - geometry.title.centre), `${label}: ${control.name} centre`).toBeLessThanOrEqual(1);
          }
        }
      }
      expect.soft(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${label}: overflow`).toBeLessThanOrEqual(1);
      if (evidence) {
        await page.screenshot({ path: join(evidence, `${screen.title.toLowerCase().replaceAll(' ', '-')}-${screen.state}-${width}.png`), fullPage: true });
      }
    }
    const json = JSON.stringify(measurements, null, 2);
    await testInfo.attach(`headers-${width}.json`, { body: json, contentType: 'application/json' });
    if (evidence) await writeFile(join(evidence, `measurements-${width}.json`), json);
  });
}
