import { expect, test, type Locator, type Page } from '@playwright/test';
import { installSyntheticApi, operation } from './synthetic-api';

async function tabTo(page: Page, target: Locator) {
  await target.waitFor({ state: 'visible' });
  for (let step = 0; step < 50; step++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

for (const width of [390, 1440]) {
  test.describe(`all-kind sheets at ${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('keyboard creates an invoice through its list money surface with one press and no review', async ({ page }) => {
      test.slow();
      const requests = await installSyntheticApi(page);
      const completed = operation('create_invoice', 'succeeded', 'completed', true);
      let confirmed = false;
      await page.route(`**/api/v1/nodes/lnd-lab/operations/${completed.id}`, route => route.fulfill({ json: confirmed ? completed : operation('create_invoice') }));
      await page.route(`**/api/v1/nodes/lnd-lab/operations/${completed.id}/confirm`, route => {
        confirmed = true;
        requests.push({ method: 'POST', path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() });
        return route.fulfill({ json: completed });
      });
      await page.goto('/nodes/lnd-lab/invoices?status=unpaid');
      const trigger = page.getByRole('button', { name: 'Create invoice', exact: true });
      await tabTo(page, trigger);
      await page.keyboard.press('Enter');
      const surface = page.getByRole('dialog', { name: 'Send and receive', exact: true });
      await expect(surface).toBeVisible();
      await expect(page).toHaveURL(url => url.pathname === '/nodes/lnd-lab/invoices' && url.searchParams.get('status') === 'unpaid' && url.searchParams.get('receive') === '1' && url.searchParams.get('action') === 'create_invoice');
      await tabTo(page, surface.getByRole('textbox', { name: /^Amount \(sat\)/ }));
      await page.keyboard.type('2500');
      await tabTo(page, surface.getByRole('textbox', { name: /^Description/ }));
      await page.keyboard.type('Coffee');
      await tabTo(page, surface.getByRole('button', { name: 'Create invoice', exact: true }));
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Create invoice', exact: true });
      await expect(dialog.getByRole('img', { name: 'Invoice QR code' })).toBeVisible();
      await expect(dialog.getByRole('heading', { name: 'Review invoice', exact: true })).toHaveCount(0);
      await expect(page).toHaveURL(url => url.pathname === '/nodes/lnd-lab/invoices' && url.searchParams.get('status') === 'unpaid' && url.searchParams.get('operation') === completed.id);
      expect(requests.filter((request) => request.path.endsWith('/confirm'))).toHaveLength(1);
      await tabTo(page, dialog.getByRole('button', { name: 'Close', exact: true }));
      await page.keyboard.press('Enter');
      await expect(dialog).toHaveCount(0);
      await expect(page).toHaveURL('/nodes/lnd-lab/invoices?status=unpaid');
      await expect(page.getByRole('button', { name: 'Send and receive', exact: true })).toBeFocused();
    });

    test('keyboard palette pushes, pops, forwards, cold-loads and selects a non-payment sheet', async ({ page }) => {
      await installSyntheticApi(page);
      await page.goto('/nodes/lnd-lab/invoices?status=unpaid');
      const trigger = page.getByRole('button', { name: width < 1024 ? 'Send and receive' : /^Go to/ });
      await tabTo(page, trigger);
      await page.keyboard.press('Control+k');
      const input = page.getByRole('combobox', { name: 'Go to', exact: true });
      await expect(input).toBeFocused();
      await expect(page).toHaveURL('/nodes/lnd-lab/invoices?status=unpaid&palette=1');
      await page.keyboard.press('Escape');
      await expect(input).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await expect(page).toHaveURL('/nodes/lnd-lab/invoices?status=unpaid');
      await page.goForward();
      await expect(input).toBeFocused();
      await page.reload();
      await expect(input).toBeFocused();
      await page.keyboard.type('Create invoice');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Create invoice', exact: true });
      await expect(dialog).toBeVisible();
      await expect(page).toHaveURL('/nodes/lnd-lab/invoices/new?status=unpaid');
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(page).toHaveURL('/nodes/lnd-lab/invoices?status=unpaid');
      await page.keyboard.press('Meta+k');
      await expect(input).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(input).toHaveCount(0);
    });
  });
}
