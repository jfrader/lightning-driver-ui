import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fixture, installSyntheticApi, UNRESOLVED_OPERATION_ID } from './synthetic-api';

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

    test('@layout single-row header and grouped money menu support keyboard, back and focus return', async ({ page }) => {
      await installSyntheticApi(page);
      await page.goto('/nodes/lnd-lab');
      const money = page.getByRole('button', { name: 'Send and receive', exact: true });
      await expect(money).toBeVisible();
      const chooser = page.getByRole('combobox', { name: 'Node' });
      const operations = page.getByRole('button', { name: 'Operations: 1', exact: true });
      await expect(operations).toBeVisible();
      const boxes = await Promise.all([chooser, operations, money].map((control) => control.boundingBox()));
      expect(boxes.every(Boolean)).toBe(true);
      const stripBoxes = width < 1024 ? boxes : boxes.slice(1);
      for (const box of stripBoxes) {
        expect(box!.height).toBe(width < 1024 ? 48 : 32);
        expect(Math.abs(box!.y + box!.height / 2 - (stripBoxes[0]!.y + stripBoxes[0]!.height / 2))).toBeLessThanOrEqual(2);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      if (width < 1024) await expect(page.getByRole('list', { name: 'Node status' })).toHaveCount(0);
      await page.screenshot({ path: test.info().outputPath(`header-${width}.png`) });
      await tabTo(page, money);
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Send and receive', exact: true });
      await expect(dialog).toBeVisible();
      if (width < 1024) await expect(dialog.locator('[data-ui="morph-surface"]')).toHaveAttribute('data-variant', 'sheet');
      else await expect(dialog).toHaveAttribute('data-ui', 'morph-surface');
      await expect(dialog.getByRole('group', { name: 'Send', exact: true })).toBeVisible();
      await expect(dialog.getByRole('group', { name: 'Receive', exact: true })).toBeVisible();
      const pay = dialog.getByRole('menuitem', { name: 'Pay invoice', exact: true });
      const address = dialog.getByRole('menuitem', { name: 'Receive address', exact: true });
      await expect(pay).toBeFocused();
      await expect.poll(async () => {
        const box = await dialog.getByRole('menuitem', { name: 'Receive address', exact: true }).boundingBox();
        return box ? Math.round(box.y + box.height) : Infinity;
      }).toBeLessThanOrEqual(900);
      for (const item of await dialog.getByRole('menuitem').all()) {
        await expect.poll(async () => Math.round((await item.boundingBox())?.height ?? 0)).toBeGreaterThanOrEqual(width < 1024 ? 44 : 32);
        const box = await item.boundingBox();
        expect(Math.round(box!.height)).toBeGreaterThanOrEqual(width < 1024 ? 44 : 32);
        expect(box!.y + box!.height).toBeLessThanOrEqual(900);
      }
      const accessibility = await new AxeBuilder({ page }).include('[role="menu"]').analyze();
      expect(accessibility.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? ''))).toEqual([]);
      await expect(dialog.locator('[role="menuitem"][tabindex="0"]')).toHaveCount(1);
      await page.keyboard.press('ArrowUp');
      await expect(address).toBeFocused();
      await page.keyboard.press('Home');
      await expect(pay).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(dialog.getByRole('menuitem', { name: 'Send on-chain', exact: true })).toBeFocused();
      await page.keyboard.press('End');
      await expect(address).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(pay).toBeFocused();
      await page.screenshot({ path: test.info().outputPath(`menu-${width}.png`) });
      await page.keyboard.press('Space');
      await expect(dialog.getByRole('textbox', { name: /^Invoice/ })).toBeFocused();
      await expect(page).toHaveURL(/send=1&action=pay_invoice/);
      if (width < 1024) {
        await expect.poll(async () => Math.round((await dialog.locator('[data-ui="bottom-sheet-panel"]').boundingBox())?.y ?? 900)).toBeLessThanOrEqual(289);
      } else {
        await expect.poll(async () => Math.round((await dialog.boundingBox())?.width ?? 0)).toBe(480);
      }
      await page.screenshot({ path: test.info().outputPath(`form-${width}.png`) });
      await page.keyboard.press('Escape');
      await expect(pay).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(dialog.getByRole('textbox', { name: /^Invoice/ })).toBeFocused();
      await dialog.getByRole('button', { name: 'Back', exact: true }).click();
      await expect(pay).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(money).toBeFocused();
    });

    test('keyboard pays through Morph to the existing review and result sheet; browser Back returns focus', async ({ page }) => {
      test.slow();
      const requests = await installSyntheticApi(page);
      await page.goto('/nodes/lnd-lab');
      const money = page.getByRole('button', { name: 'Send and receive', exact: true });
      await tabTo(page, money);
      await page.keyboard.press('Enter');
      await page.getByRole('menuitem', { name: 'Pay invoice', exact: true }).press('Enter');
      const surface = page.getByRole('dialog', { name: 'Send and receive', exact: true });
      await expect(surface.getByRole('textbox', { name: /^Invoice/ })).toBeFocused();
      await page.keyboard.type('SYNTHETIC_BOLT11_PAYMENT_NOT_PAYABLE');
      await tabTo(page, surface.getByRole('button', { name: 'Check invoice' }));
      await page.keyboard.press('Enter');
      await tabTo(page, surface.getByRole('button', { name: 'Review payment' }));
      await page.keyboard.press('Enter');
      const review = page.getByRole('dialog', { name: 'Pay invoice', exact: true });
      await expect(review.getByRole('heading', { name: 'Review payment' })).toBeVisible();
      await expect(page).toHaveURL(/\/nodes\/lnd-lab\?operation=[0-9a-f-]+$/);
      await expect(page.getByRole('dialog')).toHaveCount(1);
      expect(requests.filter((request) => request.path.endsWith('/confirm'))).toHaveLength(0);
      await page.screenshot({ path: test.info().outputPath(`review-${width}.png`) });
      await page.keyboard.press('Escape');
      await expect(review).toBeVisible();
      await tabTo(page, review.getByRole('button', { name: 'Pay with passkey' }));
      await page.keyboard.press('Enter');
      await expect(review.getByRole('heading', { name: 'Payment operation' })).toBeVisible();
      expect(requests.filter((request) => request.path.endsWith('/confirm'))).toHaveLength(1);
      await page.goBack();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page).toHaveURL('/nodes/lnd-lab');
      await expect(money).toBeFocused();
    });

    test('cold-loads both deep-link modes and the operation pill does not navigate', async ({ page }) => {
      await installSyntheticApi(page);
      for (const mode of ['send', 'receive']) {
        await page.goto(`/nodes/lnd-lab/payments?sort=amount&${mode}=1`);
        const dialog = page.getByRole('dialog', { name: 'Send and receive', exact: true });
        await expect(dialog.getByRole('menuitem')).toHaveCount(4);
        await page.keyboard.press('Escape');
        await expect(page).toHaveURL('/nodes/lnd-lab/payments?sort=amount');
        await expect(dialog).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Send and receive', exact: true })).toBeFocused();
      }
      const operations = page.getByRole('button', { name: 'Operations: 1' });
      await tabTo(page, operations);
      await page.keyboard.press('Enter');
      const popover = page.getByRole('dialog', { name: 'Operations', exact: true });
      await expect(popover.getByText('Outcome unknown', { exact: true })).toBeVisible();
      const operation = popover.getByRole('link', { name: 'Pay invoice', exact: true });
      await expect(operation).toHaveAttribute('href', `/nodes/lnd-lab/operations/${UNRESOLVED_OPERATION_ID}`);
      await expect(page).toHaveURL('/nodes/lnd-lab/payments?sort=amount');
      await tabTo(page, operation);
      await page.keyboard.press('Escape');
      await expect(popover).toHaveCount(0);
      await expect(operations).toBeFocused();
    });

    test('skips unavailable menu entries, preserves action deep links and disables the no-node control', async ({ page }) => {
      await installSyntheticApi(page);
      const node = fixture('node_lnd');
      await page.route('**/api/v1/nodes/lnd-lab', (route) => route.fulfill({ json: { ...node, capabilities: { ...node.capabilities, pay_invoice: { enabled: false, reason: 'permission_denied' } } } }));
      await page.goto('/nodes/lnd-lab?send=1');
      const blocked = page.getByRole('menuitem', { name: 'Pay invoice', exact: true });
      await expect(blocked).toBeDisabled();
      await expect(blocked).toHaveAccessibleDescription('The node credentials do not allow this action.');
      const send = page.getByRole('menuitem', { name: 'Send on-chain', exact: true });
      await expect(send).toBeFocused();
      await page.keyboard.press('ArrowUp');
      await expect(page.getByRole('menuitem', { name: 'Receive address', exact: true })).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(send).toBeFocused();
      await page.goto('/nodes/lnd-lab?receive=1&action=new_address');
      await expect(page.getByRole('dialog', { name: 'Send and receive', exact: true }).getByRole('button', { name: 'Review new address', exact: true })).toBeVisible();
      await page.goto('/fleet');
      const money = page.getByRole('button', { name: 'Send and receive', exact: true });
      await expect(money).toBeDisabled();
      await expect(money).toHaveAccessibleDescription('Select a node.');
    });
  });
}
