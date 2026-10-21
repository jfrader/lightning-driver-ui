import { expect, test, type Page } from '@playwright/test';
import examples from '../../contract/examples.v1.json' with { type: 'json' };
import { installSyntheticApi } from './synthetic-api';

const fixtures = examples.fixtures;
const SIZES = [
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1440, height: 900 },
];
const THEMES = ['dark', 'light'] as const;

/** Each list with its first record open in the inspector (Fleet has none). */
const SCREENS = [
  { name: 'Invoices', path: `/nodes/lnd-lab/invoices?selected=${fixtures.invoices_page.value.items[0].payment_hash}`, list: 'Invoices' },
  { name: 'On-chain', path: `/nodes/lnd-lab/onchain?selected=${fixtures.transactions_page.value.items[0].txid}`, list: 'Transactions' },
  { name: 'Peers', path: `/nodes/lnd-lab/peers?selected=${fixtures.peers_page.value.items[0].pubkey}`, list: 'Peers' },
  { name: 'Fleet', path: '/fleet', list: 'Nodes' },
];

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

for (const screen of SCREENS) {
  test(`${screen.name} has no horizontal overflow at 390, 768 and 1440 in dark and light`, async ({ page }) => {
    for (const theme of THEMES) {
      await page.addInitScript((value) => window.localStorage.setItem('lightning-driver.theme', value), theme);
      await installSyntheticApi(page);
      for (const size of SIZES) {
        await page.setViewportSize(size);
        await page.goto(screen.path);
        await expect(page.getByRole('main')).toBeVisible();
        await page.waitForLoadState('networkidle');
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expectNoHorizontalOverflow(page);
      }
    }
  });

  test(`${screen.name} shows rows below 48rem and a table from 48rem`, async ({ page }) => {
    await installSyntheticApi(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(screen.path);
    const rows = page.getByRole('list', { name: screen.list }).getByRole('listitem');
    await expect(rows.first()).toBeVisible();
    await expect(page.getByRole('main').getByRole('table')).toHaveCount(0);
    const box = await rows.first().boundingBox();
    if (!box) throw new Error('Missing row geometry');
    expect(box.x + box.width).toBeLessThanOrEqual(390);

    await page.setViewportSize({ width: 768, height: 900 });
    await expect(page.getByRole('main').getByRole('table')).toHaveCount(1);
    await expect(page.getByRole('list', { name: screen.list })).toHaveCount(0);
  });
}

test('the invoice inspector copies the exact invoice text', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await installSyntheticApi(page);
  const invoice = fixtures.invoices_page.value.items[0];
  await page.goto(`/nodes/lnd-lab/invoices?selected=${invoice.payment_hash}`);
  await page.getByRole('button', { name: 'Copy invoice' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(invoice.bolt11);
});
