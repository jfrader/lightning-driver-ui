import { expect, test } from '@playwright/test';
import { fixture, installSyntheticApi, operation } from './synthetic-api';

for (const width of [390, 1440]) {
  for (const kind of ['create_invoice', 'new_address'] as const) {
    test(`one Create from ${kind === 'create_invoice' ? 'Invoices' : 'On-chain'} shows the payload first at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const requests = await installSyntheticApi(page);
      const completed = operation(kind, 'succeeded', 'completed', true);
      let confirmed = false;
      await page.route(`**/api/v1/nodes/lnd-lab/operations/${completed.id}`, route => route.fulfill({ json: confirmed ? completed : operation(kind) }));
      await page.route(`**/api/v1/nodes/lnd-lab/operations/${completed.id}/confirm`, route => {
        confirmed = true;
        requests.push({ method: 'POST', path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() });
        return route.fulfill({ json: completed });
      });
      await page.goto(`/nodes/lnd-lab/${kind === 'create_invoice' ? 'invoices' : 'onchain'}`);
      await page.getByRole('button', { name: kind === 'create_invoice' ? 'Create invoice' : 'New address', exact: true }).click();
      const form = page.getByRole('dialog', { name: 'Send and receive', exact: true });
      if (kind === 'create_invoice') await form.getByLabel(/^Amount \(sat\)/).fill('2500');
      await page.evaluate(() => {
        document.documentElement.dataset.reviewSeen = 'false';
        new MutationObserver(() => {
          if ([...document.querySelectorAll('dialog h2, dialog button')].some(element => /^(Review invoice|Review new address|Discard review)$/.test(element.textContent ?? ''))) {
            document.documentElement.dataset.reviewSeen = 'true';
          }
        }).observe(document.body, { subtree: true, childList: true });
      });
      await form.getByRole('button', { name: kind === 'create_invoice' ? 'Create invoice' : 'Create address', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: kind === 'create_invoice' ? 'Create invoice' : 'New address', exact: true });
      const qr = dialog.getByRole('img', { name: kind === 'create_invoice' ? 'Invoice QR code' : 'Address QR code' });
      const copy = dialog.getByRole('button', { name: kind === 'create_invoice' ? 'Copy Invoice' : 'Copy Address', exact: true });
      await expect(qr).toBeVisible();
      await expect(copy).toBeVisible();
      await expect(page).toHaveURL(url => url.searchParams.get('operation') === completed.id);
      expect(await page.locator('html').getAttribute('data-review-seen')).toBe('false');
      expect(requests.filter(request => request.method === 'POST' && request.path.endsWith('/operations'))).toHaveLength(1);
      expect(requests.filter(request => request.path.endsWith('/confirm'))).toHaveLength(1);
      expect(requests.filter(request => request.path.includes('/authorize'))).toHaveLength(0);
      const body = dialog.locator('[data-ui="drawer-body"], [data-ui="bottom-sheet-body"]');
      await expect(body).toHaveCount(1);
      expect(await body.evaluate(element => element.scrollTop)).toBe(0);
      await expect.poll(async () => {
        const bounds = await body.boundingBox();
        if (!bounds) throw new Error('Missing sheet body');
        return Promise.all([qr, copy].map(async target => {
          const box = await target.boundingBox();
          if (!box) throw new Error('Missing result payload');
          return {
            top: box.y >= bounds.y,
            bottom: box.y + box.height <= Math.min(bounds.y + bounds.height, 844),
            left: box.x >= Math.max(bounds.x, 0),
            right: box.x + box.width <= Math.min(bounds.x + bounds.width, width),
          };
        }));
      }).toEqual(Array.from({ length: 2 }, () => ({ top: true, bottom: true, left: true, right: true })));
      expect(await body.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(dialog.getByRole('list', { name: 'Operation timeline' })).toHaveCount(1);
      await expect(dialog.getByRole('list', { name: 'Operation timeline' }).getByRole('listitem')).toHaveText([
        /^Review created/, /^Sent to node/, /^Last state change/, /^Final outcome/,
      ]);
      await expect(copy).toHaveCount(1);
      const value = kind === 'create_invoice' ? fixture('create_invoice_result').bolt11 : fixture('new_address_result').address;
      await expect(dialog.getByText(value, { exact: true })).toHaveCount(1);
      if (process.env.LOCAL_RESULT_SHOTS && test.info().project.name === 'phone-390') {
        await page.screenshot({ path: `${process.env.LOCAL_RESULT_SHOTS}/${kind}-${width}.png` });
      }
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(page).toHaveURL(`/nodes/lnd-lab/${kind === 'create_invoice' ? 'invoices' : 'onchain'}`);
    });
  }
}

test('a long invoice keeps Copy at the beginning of the payload above the fold at 390', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installSyntheticApi(page);
  const completed = operation('create_invoice', 'succeeded', 'completed', true);
  completed.result = { ...fixture('create_invoice_result'), bolt11: fixture('create_invoice_result').bolt11.repeat(48) };
  await page.route(`**/api/v1/nodes/lnd-lab/operations/${completed.id}`, route => route.fulfill({ json: completed }));
  await page.goto(`/nodes/lnd-lab/invoices?operation=${completed.id}`);
  const dialog = page.getByRole('dialog', { name: 'Create invoice', exact: true });
  const copy = dialog.getByRole('button', { name: 'Copy Invoice', exact: true });
  await expect(copy).toBeVisible();
  await expect.poll(async () => {
    const box = await copy.boundingBox();
    return box !== null && box.y >= 0 && box.y + box.height <= 844;
  }).toBe(true);
  const body = dialog.locator('[data-ui="bottom-sheet-body"]');
  expect(await body.evaluate(element => element.scrollTop)).toBe(0);
  expect(await body.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

for (const kind of ['new_address', 'create_invoice'] as const) {
  test(`completed ${kind} keeps its result and timeline without node observation`, async ({ page }) => {
    await installSyntheticApi(page);
    const completed = operation(kind, 'succeeded', 'completed', true);
    await page.route(`**/api/v1/nodes/lnd-lab/operations/${completed.id}`, route => route.fulfill({ json: completed }));
    await page.goto(`/nodes/lnd-lab/operations/${completed.id}`);
    await expect(page.getByText(kind === 'new_address' ? 'Address created.' : 'Invoice created.', { exact: true })).toBeVisible();
    await expect(page.getByText('Not checked with the node yet', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Last checked with the node', { exact: true })).toHaveCount(0);
    const value = kind === 'new_address' ? fixture('new_address_result').address : fixture('create_invoice_result').bolt11;
    await expect(page.getByText(value, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: kind === 'new_address' ? 'Copy Address' : 'Copy Invoice', exact: true })).toBeVisible();
    for (const label of ['Review created', 'Sent to node', 'Last state change', 'Final outcome']) {
      await expect(page.getByRole('list', { name: 'Operation timeline' }).getByRole('listitem').filter({ hasText: label })).toBeVisible();
    }
  });
}

test('a pending payment still shows its unobserved node check', async ({ page }) => {
  await installSyntheticApi(page);
  const pending = { ...operation('pay_invoice', 'pending', 'submitted'), last_reconciled_at: null };
  await page.route(`**/api/v1/nodes/lnd-lab/operations/${pending.id}`, route => route.fulfill({ json: pending }));
  await page.goto(`/nodes/lnd-lab/operations/${pending.id}`);
  await expect(page.getByText('Not checked with the node yet', { exact: true })).toBeVisible();
  await expect(page.getByText('Last checked with the node', { exact: true })).toBeVisible();
});

test('overview attention omits node checks only for stale local results', async ({ page }) => {
  await installSyntheticApi(page);
  const items = (['new_address', 'create_invoice', 'pay_invoice'] as const).map(kind => ({
    ...operation(kind, 'pending', 'submitted'),
    last_reconciled_at: null,
  }));
  await page.route('**/api/v1/nodes/lnd-lab/operations?*', route => route.fulfill({
    json: { ...fixture('operations_page'), node_id: items[0].node_id, network: items[0].review.node.network, items },
  }));
  await page.goto('/nodes/lnd-lab');
  await expect(page.getByRole('link', { name: 'View operation', exact: true })).toHaveCount(3);
  await expect(page.getByText('Not checked with the node yet', { exact: true })).toHaveCount(1);
});
