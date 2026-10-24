import { expect, test, type Locator, type Page } from '@playwright/test';
import { fixture, installSyntheticApi } from './synthetic-api';

async function tabTo(page: Page, target: Locator) {
  await target.waitFor({ state: 'attached' });
  for (let step = 0; step < 20; step++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

for (const width of [390, 1440]) {
  test.describe(`payment sheet at ${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('keyboard opens over the list, traps focus, preserves state and returns focus on Escape', async ({ page }) => {
      await installSyntheticApi(page);
      const hash = fixture('payments_page').items[0].payment_hash;
      const path = `/nodes/lnd-lab/payments?status=succeeded&sort=amount&dir=asc&selected=${hash}`;
      await page.goto(path);
      const trigger = page.getByRole('link', { name: 'Pay invoice', exact: true });
      await tabTo(page, trigger);
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Pay invoice' });
      await expect(dialog).toBeVisible();
      await expect(page).toHaveURL(path.replace('/payments?', '/payments/new?'));
      for (const direction of ['Tab', 'Shift+Tab']) {
        for (let index = 0; index < 10; index++) {
          await page.keyboard.press(direction);
          expect(await dialog.evaluate((element) => document.activeElement === document.body || element.contains(document.activeElement))).toBe(true);
        }
      }
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(page).toHaveURL(path);
      await expect(trigger).toBeFocused();
    });

    test('keyboard checks, reviews and confirms with the review in the URL; review refuses Escape', async ({ page }) => {
      // Tabs through the whole sheet and the review: slow under parallel load.
      test.slow();
      const requests = await installSyntheticApi(page);
      await page.goto('/nodes/lnd-lab/payments/new?sort=amount');
      const dialog = page.getByRole('dialog', { name: 'Pay invoice' });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator(':focus')).toHaveCount(1);
      await tabTo(page, dialog.getByRole('textbox', { name: /^Invoice/ }));
      await page.keyboard.type('SYNTHETIC_BOLT11_PAYMENT_NOT_PAYABLE');
      await tabTo(page, dialog.getByRole('button', { name: 'Check invoice' }));
      await page.keyboard.press('Enter');
      await tabTo(page, dialog.getByRole('button', { name: 'Review payment' }));
      await page.keyboard.press('Enter');
      await expect(dialog.getByRole('heading', { name: 'Review payment' })).toBeVisible();
      await expect(page).toHaveURL(/\/payments\/review\/[0-9a-f-]+\?sort=amount$/);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0);
      expect(requests.filter((request) => request.path.endsWith('/confirm'))).toHaveLength(0);
      await tabTo(page, dialog.getByRole('button', { name: 'Pay with passkey' }));
      await page.keyboard.press('Enter');
      await expect(dialog.getByRole('heading', { name: 'Payment operation' })).toBeVisible();
      expect(requests.filter((request) => request.path.endsWith('/confirm'))).toHaveLength(1);
      await expect(page).toHaveURL(/\/payments\/review\/[0-9a-f-]+\?sort=amount$/);
      await tabTo(page, dialog.getByRole('button', { name: 'Close', exact: true }));
      await page.keyboard.press('Enter');
      await expect(dialog).toHaveCount(0);
      await expect(page).toHaveURL('/nodes/lnd-lab/payments?sort=amount');
    });

    test('palette opens the payment sheet and a blocked payment retains its literal reason', async ({ page }) => {
      await installSyntheticApi(page);
      await page.goto('/nodes/lnd-lab/payments?sort=amount');
      await expect(page.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible();
      const trigger = page.getByRole('button', { name: width < 1024 ? 'Search' : /^Go to/ });
      await tabTo(page, trigger);
      await page.keyboard.press('Control+k');
      await page.getByRole('combobox', { name: 'Go to', exact: true }).pressSequentially('Pay invoice');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog', { name: 'Pay invoice' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      const node = fixture('node_lnd');
      await page.route('**/api/v1/nodes/lnd-lab', (route) => route.fulfill({ json: {
        ...node, capabilities: { ...node.capabilities, pay_invoice: { enabled: false, reason: 'syncing' } },
      } }));
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Payments', exact: true })).toBeVisible();
      await page.keyboard.press('Meta+k');
      await expect(page.getByRole('option', { name: /Pay invoice.*The node is syncing\./ })).toHaveAttribute('aria-disabled', 'true');
    });

    test('explicit discard returns to the form and backdrop dismissal cannot abandon a review', async ({ page }) => {
      test.skip(width < 1024, 'full-height bottom sheet has no exposed backdrop');
      await installSyntheticApi(page);
      await page.goto('/nodes/lnd-lab/payments/new');
      const dialog = page.getByRole('dialog', { name: 'Pay invoice' });
      await expect(dialog).toBeVisible();
      await page.mouse.click(10, 10);
      await expect(dialog).toHaveCount(0);
      await page.getByRole('link', { name: 'Pay invoice', exact: true }).click();
      await dialog.getByRole('textbox', { name: /^Invoice/ }).fill('SYNTHETIC_BOLT11_PAYMENT_NOT_PAYABLE');
      await dialog.getByRole('button', { name: 'Check invoice' }).click();
      await dialog.getByRole('button', { name: 'Review payment' }).click();
      await expect(dialog.getByRole('heading', { name: 'Review payment' })).toBeVisible();
      await page.mouse.click(10, 10);
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Discard review' }).click();
      await expect(page).toHaveURL(/\/payments\/new$/);
      await expect(dialog.getByRole('textbox', { name: /^Invoice/ })).toHaveValue('');
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(dialog).toHaveCount(0);
    });
  });
}
