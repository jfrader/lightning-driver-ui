import { expect, test, type Locator, type Page } from '@playwright/test';
import { installSyntheticApi, UNRESOLVED_OPERATION_ID } from './synthetic-api';

async function tabTo(page: Page, target: Locator) {
  await target.waitFor({ state: 'visible' });
  for (let step = 0; step < 50; step++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

for (const width of [390, 1440]) {
  test.describe(`global money actions at ${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('keyboard pays from Overview with the review and result in one sheet; Back returns to Overview', async ({ page }) => {
      test.slow();
      const requests = await installSyntheticApi(page);
      await page.goto('/nodes/lnd-lab');
      await expect(page.getByRole('heading', { name: 'Balances', exact: true })).toBeVisible();
      const send = page.getByRole('button', { name: 'Send', exact: true });
      await tabTo(page, send);
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL('/nodes/lnd-lab?send=1');
      await tabTo(page, page.getByRole('button', { name: 'Pay invoice', exact: true }));
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Pay invoice', exact: true });
      await tabTo(page, dialog.getByRole('textbox', { name: /^Invoice/ }));
      await page.keyboard.type('SYNTHETIC_BOLT11_PAYMENT_NOT_PAYABLE');
      await tabTo(page, dialog.getByRole('button', { name: 'Check invoice' }));
      await page.keyboard.press('Enter');
      await tabTo(page, dialog.getByRole('button', { name: 'Review payment' }));
      await page.keyboard.press('Enter');
      await expect(dialog.getByRole('heading', { name: 'Review payment' })).toBeVisible();
      await expect(page).toHaveURL(/\/nodes\/lnd-lab\?operation=[0-9a-f-]+$/);
      await expect(page.getByRole('dialog')).toHaveCount(1);
      expect(requests.filter((request) => request.path.endsWith('/confirm'))).toHaveLength(0);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
      await tabTo(page, dialog.getByRole('button', { name: 'Pay with passkey' }));
      await page.keyboard.press('Enter');
      await expect(dialog.getByRole('heading', { name: 'Payment operation' })).toBeVisible();
      expect(requests.filter((request) => request.path.endsWith('/confirm'))).toHaveLength(1);
      await page.goBack();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page).toHaveURL('/nodes/lnd-lab');
      await expect(page.getByRole('heading', { name: 'Balances', exact: true })).toBeVisible();
      await expect(send).toBeFocused();
    });

    test('cold-loads send on the existing screen; keyboard Receive and live-operation popover do not navigate', async ({ page }) => {
      await installSyntheticApi(page);
      await page.goto('/nodes/lnd-lab/payments?sort=amount&send=1');
      const dialog = page.getByRole('dialog', { name: 'Send', exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Pay invoice', exact: true })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Send on-chain', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page).toHaveURL('/nodes/lnd-lab/payments?sort=amount');
      await tabTo(page, page.getByRole('button', { name: 'Receive', exact: true }));
      await page.keyboard.press('Enter');
      const receive = page.getByRole('dialog', { name: 'Receive', exact: true });
      await expect(receive.getByRole('button', { name: 'Create invoice', exact: true })).toBeVisible();
      await expect(receive.getByRole('button', { name: 'New address', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await tabTo(page, page.getByRole('button', { name: '1 in progress' }));
      await page.keyboard.press('Enter');
      const popover = page.getByRole('dialog', { name: 'Operations in progress' });
      await expect(popover.getByText('Outcome unknown', { exact: true })).toBeVisible();
      await expect(popover.getByText('Checking with node', { exact: true })).toBeVisible();
      const operation = popover.getByRole('link', { name: 'Pay invoice', exact: true });
      await expect(operation).toHaveAttribute('href', `/nodes/lnd-lab/operations/${UNRESOLVED_OPERATION_ID}`);
      if (width < 768) {
        const target = await operation.boundingBox();
        expect(target?.width).toBeGreaterThanOrEqual(44);
        expect(target?.height).toBeGreaterThanOrEqual(44);
      }
      await expect(page).toHaveURL('/nodes/lnd-lab/payments?sort=amount');
      await tabTo(page, operation);
      await page.keyboard.press('Escape');
      await expect(popover).toHaveCount(0);
      await expect(page.getByRole('button', { name: '1 in progress' })).toBeFocused();
    });

  });
}
