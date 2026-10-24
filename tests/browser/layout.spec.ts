import { expect, test } from '@playwright/test';
import { fixture, installSyntheticApi, operation, UNRESOLVED_OPERATION_ID } from './synthetic-api';
import { doubleText } from './text-size';
import AxeBuilder from '@axe-core/playwright';

const root = '/nodes/lnd-lab';
const cases = [
  { width: 320, path: `${root}/operations/${UNRESOLVED_OPERATION_ID}` },
  { width: 320, path: `${root}/channels?selected=${fixture('channels_page').items[0].id}` },
  { width: 1440, path: `${root}/payments?selected=${fixture('payments_page').items[0].payment_hash}` },
  { width: 1440, path: `${root}/onchain?selected=${fixture('transactions_page').items[0].txid}` },
  { width: 1440, path: `${root}/peers?selected=${fixture('peers_page').items[0].pubkey}` },
  { width: 390, path: `${root}/onchain/send` },
  ...(['send_onchain', 'open_channel', 'close_channel', 'new_address', 'connect_peer', 'create_invoice', 'pay_invoice'] as const).map(kind => ({ width: 320, path: `${root}/operations/${operation(kind).id}` })),
  ...['onchain/receive', 'peers/new', 'channels/new'].map(path => ({ width: 320, path: `${root}/${path}` })),
];

test('channel close keeps accessible destructive-action contrast in both themes', async ({ page }) => {
  await installSyntheticApi(page);
  const path = `${root}/channels/${fixture('channels_page').items[0].id}/close`;
  for (const theme of ['dark', 'light']) {
    await page.addInitScript(value => localStorage.setItem('lightning-driver.theme', value), theme);
    await page.goto(path);
    const review = page.getByRole('button', { name: 'Review close', exact: true });
    await expect(review).toBeVisible();
    for (const hover of [false, true]) {
      if (hover) await review.hover();
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect.soft(result.violations.filter(item => item.impact === 'serious' || item.impact === 'critical'), `${theme}, hover ${hover}`).toEqual([]);
    }
  }
});

for (const locale of ['en-US', 'de-DE']) test.describe(locale, () => {
  test.use({ locale });
  test('@layout enlarged Lightning details and fee choices stay inside the workspace', async ({ page }) => {
    await installSyntheticApi(page);
    for (const { width, path } of cases) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      await page.waitForLoadState('networkidle');
      if (!path.includes('?selected=') && !path.includes('/operations/')) {
        await expect(page.getByRole('button', { name: /^Review / })).toBeVisible();
      }
      await page.evaluate(() => document.fonts.ready);
      await doubleText(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect.soft(overflow, `${locale} ${width} ${path}`).toBeLessThanOrEqual(1);
      for (const action of await page.getByRole('main').getByRole('button', { name: /^(Review |Economy |Normal |Priority )/ }).all()) {
        const fits = await action.evaluate(element => {
          const box = element.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(element);
          const text = range.getBoundingClientRect();
          return text.left >= box.left - 1 && text.right <= box.right + 1 && text.top >= box.top - 1 && text.bottom <= box.bottom + 1;
        });
        expect.soft(fits, `${locale} ${width} ${path}: ${await action.textContent()}`).toBe(true);
      }
    }
  });
});
