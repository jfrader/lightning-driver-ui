import { expect, test, type Page } from '@playwright/test';
import { installSyntheticApi, operation } from './synthetic-api';

const MIN_TARGET_PX = 32;

async function expectCopyTargets(page: Page) {
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
    expect(box.width, `${box.name} width`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
    expect(box.height, `${box.name} height`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
  }
}

test('copy buttons beside long values keep their full target on the payment review', async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto(`/nodes/lnd-lab/operations/${operation('pay_invoice').id}`);
  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible();
  await expectCopyTargets(page);
});

test('copy buttons beside long invoices keep their full target in the invoice list', async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto('/nodes/lnd-lab/invoices');
  await expectCopyTargets(page);
});
