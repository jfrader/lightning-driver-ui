import { expect, test } from '@playwright/test';
import { installSyntheticApi } from './synthetic-api';

/**
 * A filter menu is a popover: it must paint above the sticky table header and its options must take
 * the click, not the header underneath. The State filter's first options sat behind the header.
 */
test('filter options sit above the sticky header and apply the filter', async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto('/nodes/lnd-lab/payments');
  await expect(page.getByRole('main')).toBeVisible();
  await page.waitForLoadState('networkidle');

  const filter = page.getByRole('combobox', { name: 'State' });
  await filter.click();
  const options = page.getByRole('listbox').getByRole('option');
  const count = await options.count();
  expect(count).toBeGreaterThan(1);

  for (let index = 0; index < count; index += 1) {
    const box = await options.nth(index).boundingBox();
    expect(box, `option ${index} has a box`).not.toBeNull();
    const hitsOption = await page.evaluate(
      ({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('[role="option"]')),
      { x: (box?.x ?? 0) + 8, y: (box?.y ?? 0) + (box?.height ?? 0) / 2 },
    );
    expect(hitsOption, `option ${index} is covered by the table header`).toBe(true);
  }

  await page.getByRole('option', { name: 'Pending', exact: true }).click();
  await expect(filter).toHaveText('Pending');
  await expect(page).toHaveURL(/status=pending/);
});
