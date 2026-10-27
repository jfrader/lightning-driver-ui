import { expect, test, type Page } from '@playwright/test';
import { installSyntheticApi, operation } from './synthetic-api';

const SIZES = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectVisibleConfirmation(page: Page, name: string) {
  const action = page.getByRole('dialog').getByRole('button', { name });
  await action.scrollIntoViewIfNeeded();
  const geometry = await action.evaluate(element => {
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return { top: box.top, bottom: box.bottom, viewport: innerHeight, hit: hit === element || element.contains(hit) };
  });
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewport);
  expect(geometry.hit).toBe(true);
}

for (const size of SIZES) {
  test.describe(`at ${size.width}`, () => {
    test.use({ viewport: size });

    test('low-risk: one invoice Create press confirms it and the operation follows without review', async ({ page }) => {
      const requests = await installSyntheticApi(page);
      await page.goto('/nodes/lnd-lab/invoices/new');
      await page.getByLabel(/^Amount \(sat\)/).fill('2500');
      await page.getByRole('textbox', { name: /^Description/ }).fill('Coffee');
      await expectNoHorizontalOverflow(page);
      await page.getByRole('dialog').getByRole('button', { name: 'Create invoice', exact: true }).click();

      await expect(page.getByRole('heading', { name: 'Invoice operation' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Review invoice' })).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      await expect(page.getByText('Sent to the node. No invoice reported yet.')).toBeVisible();
      expect(requests.map((r) => r.path)).toEqual([
        '/nodes/lnd-lab/operations',
        `/nodes/lnd-lab/operations/${operation('create_invoice').id}/confirm`,
      ]);
      for (const name of ['Create invoice', 'Retry', 'Try again']) {
        await expect(page.getByRole('dialog').getByRole('button', { name })).toHaveCount(0);
      }
    });

    test('sensitive: an on-chain send review needs the passkey step-up before its one confirm', async ({ page }) => {
      const requests = await installSyntheticApi(page);
      await page.goto('/nodes/lnd-lab/onchain/send');
      await page.getByRole('textbox', { name: /^Address/ }).fill('SYNTHETIC_REGTEST_ADDRESS_NOT_SENDABLE');
      await page.getByLabel(/^Amount \(sat\)/).fill('10000');
      await page.getByLabel(/^Fee rate/).fill('2');
      await page.getByRole('button', { name: 'Review send' }).click();

      await expect(page.getByRole('heading', { name: 'Review send' })).toBeVisible();
      await expect(page.getByText('Requested; the final fee can differ')).toBeVisible();
      await expect(page.getByText('Total')).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      await expectVisibleConfirmation(page, 'Send with passkey');

      await page.keyboard.press('Control+Enter');
      expect(requests.filter((r) => r.path.endsWith('/confirm'))).toEqual([]);
      await page.getByRole('button', { name: 'Send with passkey' }).click();

      await expect(page.getByRole('heading', { name: 'On-chain send operation' })).toBeVisible();
      await expect(page.getByText('Sent to the node. Not yet reported as broadcast.')).toBeVisible();
      const id = operation('send_onchain').id;
      expect(requests.map((r) => r.path)).toEqual([
        '/nodes/lnd-lab/operations',
        `/nodes/lnd-lab/operations/${id}/authorize`,
        `/nodes/lnd-lab/operations/${id}/confirm`,
      ]);
      expect(requests.at(-1)?.body).toEqual({ review_digest: operation('send_onchain').review.digest, authorization_id: '00000000-0000-4000-8000-000000000301' });
      await expect(page.getByRole('button', { name: /passkey|Retry|again/i })).toHaveCount(0);
    });
  });
}
