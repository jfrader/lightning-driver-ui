import { expect, test, type Page } from '@playwright/test';
import examples from '../../contract/examples.v1.json' with { type: 'json' };
import { installSyntheticApi, operation } from './synthetic-api';
import { doubleText } from './text-size';

const MIN_TARGET_PX = 32;
const MIN_PHONE_TARGET_PX = 44;

async function expectCopyTargets(page: Page) {
  const minimum = (page.viewportSize()?.width ?? 0) < 768 ? MIN_PHONE_TARGET_PX : MIN_TARGET_PX;
  const buttons = page.getByRole('button', { name: /^Copy / });
  await expect(buttons.first()).toBeVisible();
  const boxes = await buttons.evaluateAll((elements) =>
    elements.map((element) => {
      const { width, height } = element.getBoundingClientRect();
      return { name: element.getAttribute('aria-label') ?? element.textContent, width, height };
    }),
  );
  expect(boxes.length).toBeGreaterThan(0);
  for (const box of boxes) {
    expect(box.width, `${box.name} width`).toBeGreaterThanOrEqual(minimum);
    expect(box.height, `${box.name} height`).toBeGreaterThanOrEqual(minimum);
  }
}

test('copy buttons beside long values keep their full target on the payment review', async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto(`/nodes/lnd-lab/operations/${operation('pay_invoice').id}`);
  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible();
  await expectCopyTargets(page);
});

test('completed operation results retain readable details and usable copy targets with enlarged text', async ({ page }) => {
  await installSyntheticApi(page);
  const completed = operation('pay_invoice', 'succeeded', 'completed', true);
  await page.route(`**/api/v1/nodes/lnd-lab/operations/${completed.id}`, route => route.fulfill({ json: completed }));
  await page.goto(`/nodes/lnd-lab/operations/${completed.id}`);
  await expect(page.getByRole('heading', { name: 'Payment operation' })).toBeVisible();
  for (const enlarged of [false, true]) {
    if (enlarged) await doubleText(page);
    await expectCopyTargets(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

test('copy buttons beside long invoices keep their full target in the invoice inspector', async ({ page }) => {
  await installSyntheticApi(page);
  // Copy lives in the inspector; the technical details hold the long hash and invoice text.
  await page.goto(`/nodes/lnd-lab/invoices?selected=${examples.fixtures.invoices_page.value.items[0].payment_hash}`);
  await page.getByRole('button', { name: 'Technical details' }).click();
  await expectCopyTargets(page);
});
