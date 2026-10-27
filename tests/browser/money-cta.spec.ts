import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fixture, installSyntheticApi, operation } from './synthetic-api';

const entries = [
  { page: 'payments', label: 'Pay invoice', action: 'pay_invoice', mode: 'send', field: 'Invoice' },
  { page: 'invoices', label: 'Create invoice', action: 'create_invoice', mode: 'receive', field: 'Amount (sat)' },
  { page: 'onchain', label: 'New address', action: 'new_address', mode: 'receive', field: 'Address type' },
  { page: 'onchain', label: 'Send on-chain', action: 'send_onchain', mode: 'send', field: 'Address' },
  { page: '', label: 'Pay invoice', action: 'pay_invoice', mode: 'send', field: 'Invoice' },
  { page: '', label: 'Receive', action: 'create_invoice', mode: 'receive', field: 'Amount (sat)' },
  { page: '', label: 'New address', action: 'new_address', mode: 'receive', field: 'Address type' },
  { page: '', label: 'Send on-chain', action: 'send_onchain', mode: 'send', field: 'Address' },
] as const;

for (const width of [390, 1440]) {
  test.describe(`money CTAs at ${width}`, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const entry of entries) {
      test(`${entry.page || 'overview'} / ${entry.label} opens its global step without a route drawer`, async ({ page }) => {
        await installSyntheticApi(page);
        const pathname = `/nodes/lnd-lab${entry.page ? `/${entry.page}` : ''}`;
        await page.goto(pathname);
        await page.getByRole('button', { name: entry.label, exact: true }).click();
        const morph = page.getByRole('dialog', { name: 'Send and receive', exact: true });
        await expect(morph).toBeVisible();
        if (entry.action === 'new_address') await expect(morph.getByRole('button', { name: 'Create address', exact: true })).toBeVisible();
        else await expect(morph.getByLabel(entry.field, { exact: false })).toBeVisible();
        await expect(page.getByRole('dialog')).toHaveCount(1);
        await expect(page.locator('[data-ui="morph-surface"]')).toBeVisible();
        await expect(page).toHaveURL((url) => url.pathname === pathname && url.searchParams.get(entry.mode) === '1' && url.searchParams.get('action') === entry.action);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
        const accessibility = await new AxeBuilder({ page }).include('[data-ui="morph-surface"]').analyze();
        expect(accessibility.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? ''))).toEqual([]);
        await page.screenshot({ path: test.info().outputPath(`${entry.page || 'overview'}-${entry.action}-${width}.png`) });
        await morph.getByRole('button', { name: 'Back', exact: true }).click();
        await expect(morph.getByRole('menuitem', { name: 'Pay invoice', exact: true })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(page).toHaveURL(pathname);
      });
    }

    test('blocked page CTAs keep their disabled state and literal reason', async ({ page }) => {
      await installSyntheticApi(page);
      const node = fixture('node_lnd');
      await page.route('**/api/v1/nodes/lnd-lab', route => route.fulfill({ json: {
        ...node,
        capabilities: Object.fromEntries(Object.keys(node.capabilities).map(key => [key, { enabled: false, reason: 'permission_denied' }])),
      } }));
      for (const entry of entries) {
        await page.goto(`/nodes/lnd-lab${entry.page ? `/${entry.page}` : ''}`);
        const label = entry.action === 'create_invoice' ? 'Create invoice' : entry.label;
        const button = page.getByRole('button', { name: label, exact: true });
        await expect(button).toBeDisabled();
        await expect(button).toHaveAccessibleDescription('The node credentials do not allow this action.');
        await expect(page.getByRole('dialog')).toHaveCount(0);
      }
    });

    test('money review restart controls use the same global steps', async ({ page }) => {
      await installSyntheticApi(page);
      for (const entry of entries.slice(0, 4)) {
        const expired = operation(entry.action);
        expired.review.expires_at = expired.created_at;
        await page.route(`**/api/v1/nodes/lnd-lab/operations/${expired.id}`, route => route.fulfill({ json: expired }));
        const pathname = `/nodes/lnd-lab/operations/${expired.id}`;
        await page.goto(pathname);
        await page.getByRole('button', { name: 'Start a new review', exact: true }).click();
        const morph = page.getByRole('dialog', { name: 'Send and receive', exact: true });
        await expect(morph).toBeVisible();
        await expect(page.getByRole('dialog')).toHaveCount(1);
        await expect(page).toHaveURL(url => url.pathname === pathname && url.searchParams.get(entry.mode) === '1' && url.searchParams.get('action') === entry.action);
      }
    });
  });
}
