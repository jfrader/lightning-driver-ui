import { expect, test, type Page } from '@playwright/test';
import { FIXTURE_NOW, fixture, installSyntheticApi, operation } from './synthetic-api';

async function stubClipboard(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (value: string) => { document.documentElement.dataset.copiedValue = value; },
    } });
  });
}

for (const width of [390, 1440]) {
  for (const kind of ['create_invoice', 'new_address'] as const) {
    test(`one Create from ${kind === 'create_invoice' ? 'Invoices' : 'On-chain'} shows the payload first at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const requests = await installSyntheticApi(page);
      await stubClipboard(page);
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
      const receipt = dialog.getByRole('region', { name: kind === 'create_invoice' ? 'Invoice receipt' : 'Address receipt' });
      await expect(receipt).toBeVisible();
      expect(await receipt.evaluate(element => element.parentElement?.firstElementChild === element)).toBe(true);
      const state = receipt.getByText(kind === 'create_invoice' ? 'Unpaid' : 'Created', { exact: true });
      const created = receipt.getByText(/^Created /);
      const payload = kind === 'create_invoice' ? fixture('create_invoice_result').bolt11 : fixture('new_address_result').address;
      const field = receipt.getByRole('region', { name: kind === 'create_invoice' ? 'Invoice value' : 'Address value', exact: true });
      const hero = kind === 'create_invoice' ? receipt.getByText('2,500 sat', { exact: true }) : field;
      await expect(field).toHaveText(payload);
      expect(await field.textContent()).toBe(payload);
      await expect(state).toBeVisible();
      await expect(receipt.getByText('Succeeded', { exact: true })).toHaveCount(0);
      await expect(created).toHaveText('Created 1 minute ago · 12:00:00 UTC');
      await expect(hero).toBeVisible();
      const visibleTargets = [qr, copy, field, state, created];
      if (kind === 'create_invoice') {
        visibleTargets.push(hero);
        const expiry = receipt.getByText(/^Expires /);
        await expect(expiry).toHaveText('Expires in 59 minutes · 13:00:00 UTC');
        await expect(receipt.getByText('Synthetic invoice', { exact: true })).toBeVisible();
        visibleTargets.push(expiry);
      } else {
        await expect(receipt.getByText(/sat|BTC|Any amount/)).toHaveCount(0);
        await expect(receipt.getByText(/^Expires /)).toHaveCount(0);
      }
      await expect(dialog.getByRole('img', { name: /QR code/ })).toHaveCount(1);
      const qrBounds = await qr.boundingBox();
      expect(qrBounds?.width).toBeGreaterThanOrEqual(160);
      expect(await body.evaluate(element => element.scrollTop)).toBe(0);
      await expect.poll(async () => {
        const bounds = await body.boundingBox();
        if (!bounds) throw new Error('Missing sheet body');
        return Promise.all(visibleTargets.map(async target => {
          const box = await target.boundingBox();
          if (!box) throw new Error('Missing result payload');
          return {
            top: box.y >= bounds.y,
            bottom: box.y + box.height <= Math.min(bounds.y + bounds.height, 844),
            left: box.x >= Math.max(bounds.x, 0),
            right: box.x + box.width <= Math.min(bounds.x + bounds.width, width),
          };
        }));
      }).toEqual(Array.from({ length: visibleTargets.length }, () => ({ top: true, bottom: true, left: true, right: true })));
      expect(await body.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(dialog.getByRole('list', { name: 'Operation timeline' })).toHaveCount(1);
      await expect(dialog.getByRole('list', { name: 'Operation timeline' }).getByRole('listitem')).toHaveText([
        /^Review created/, /^Sent to node/, /^Last state change/, /^Final outcome/,
      ]);
      await expect(copy).toHaveCount(1);
      const value = kind === 'create_invoice' ? fixture('create_invoice_result').bolt11 : fixture('new_address_result').address;
      await expect(dialog.getByText(value, { exact: true })).toHaveCount(kind === 'create_invoice' ? 2 : 1);
      if (process.env.LOCAL_RESULT_SHOTS && test.info().project.name === 'phone-390') {
        await page.screenshot({ path: `${process.env.LOCAL_RESULT_SHOTS}/${kind}-${width}.png` });
      }
      await copy.click();
      expect(await page.locator('html').getAttribute('data-copied-value')).toBe(value);
      await expect(receipt.getByRole('status')).toHaveText('Copied');
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(page).toHaveURL(`/nodes/lnd-lab/${kind === 'create_invoice' ? 'invoices' : 'onchain'}`);
    });
  }
}

for (const width of [390, 1440]) {
  for (const state of ['paid', 'expired', 'canceled', 'unknown', 'missing'] as const) {
    test(`invoice receipt reports ${state} from the first invoice page at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await installSyntheticApi(page);
      const completed = operation('create_invoice', 'succeeded', 'completed', true);
      const source = fixture('invoices_page');
      const reportedState = state === 'missing' ? 'paid' : state;
      const invoice = {
        ...source.items[0], state: reportedState,
        payment_hash: state === 'missing' ? 'c'.repeat(64) : source.items[0].payment_hash,
        ...(reportedState === 'paid' ? { received_msat: source.items[0].amount_msat, paid_at: FIXTURE_NOW.toISOString(), backend_state: 'SETTLED' } : {}),
      };
      await page.route('**/api/v1/nodes/lnd-lab/invoices?*', route => {
        const params = new URL(route.request().url()).searchParams;
        expect(params.get('limit')).toBe('100');
        expect(params.has('cursor')).toBe(false);
        return route.fulfill({ json: { ...source, items: [invoice] } });
      });
      await page.route(`**/api/v1/nodes/lnd-lab/operations/${completed.id}`, route => route.fulfill({ json: completed }));
      await page.goto(`/nodes/lnd-lab/operations?operation=${completed.id}`);
      const receipt = page.getByRole('region', { name: 'Invoice receipt' });
      const label = { paid: 'Paid', expired: 'Expired', canceled: 'Canceled', unknown: 'State unknown', missing: 'Unpaid' }[state];
      await expect(receipt.getByText(label, { exact: true })).toBeVisible();
      await expect(receipt.getByText('Succeeded', { exact: true })).toHaveCount(0);
      if (state === 'paid' && process.env.LOCAL_RESULT_SHOTS && test.info().project.name === 'phone-390') {
        await page.screenshot({ path: `${process.env.LOCAL_RESULT_SHOTS}/paid-invoice-${width}.png` });
      }
    });
  }
}

for (const finish of ['paid', 'expired', 'unmount'] as const) {
  test(`invoice receipt polls while unpaid and stops on ${finish}`, async ({ page }) => {
    await installSyntheticApi(page);
    await page.clock.install({ time: FIXTURE_NOW });
    const completed = operation('create_invoice', 'succeeded', 'completed', true);
    const source = fixture('invoices_page');
    let reads = 0;
    let state = 'unpaid';
    await page.route('**/api/v1/nodes/lnd-lab/invoices?*', route => {
      reads += 1;
      return route.fulfill({ json: { ...source, items: [{
        ...source.items[0], state,
        ...(state === 'paid' ? { received_msat: source.items[0].amount_msat, paid_at: FIXTURE_NOW.toISOString(), backend_state: 'SETTLED' } : {}),
      }] } });
    });
    await page.route(`**/api/v1/nodes/lnd-lab/operations/${completed.id}`, route => route.fulfill({ json: completed }));
    await page.goto(`/nodes/lnd-lab/operations?operation=${completed.id}`);
    const receipt = page.getByRole('region', { name: 'Invoice receipt' });
    await expect(receipt.getByText('Unpaid', { exact: true })).toBeVisible();
    await expect.poll(() => reads).toBe(1);
    await page.clock.runFor(5000);
    await expect.poll(() => reads).toBe(2);
    if (finish === 'unmount') {
      await page.keyboard.press('Escape');
      await expect(receipt).toHaveCount(0);
    } else {
      state = finish;
      await page.clock.runFor(5000);
      await expect(receipt.getByText(finish === 'paid' ? 'Paid' : 'Expired', { exact: true })).toBeVisible();
      expect(reads).toBe(3);
    }
    const stoppedReads = reads;
    await page.clock.runFor(20_000);
    expect(reads).toBe(stoppedReads);
  });
}

test('invoice receipt uses request values, the session unit and the invoice state', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 844 });
  await installSyntheticApi(page);
  const completed = {
    ...operation('create_invoice', 'pending', 'submitted', true),
    request: { ...fixture('create_invoice_request'), params: { amount_msat: '3123456', description: '', expiry_seconds: 1800 } },
  };
  await page.route(`**/api/v1/nodes/lnd-lab/operations/${completed.id}`, route => route.fulfill({ json: completed }));
  await page.goto(`/nodes/lnd-lab/operations/${completed.id}`);
  const receipt = page.getByRole('region', { name: 'Invoice receipt' });
  await expect(receipt.getByText('3,123.456 sat', { exact: true })).toBeVisible();
  await expect(receipt.getByText('Unpaid', { exact: true })).toBeVisible();
  await expect(receipt.getByText('Pending', { exact: true })).toHaveCount(0);
  await expect(receipt.getByText(/^Expires /)).toHaveText('Expires in 29 minutes · 12:30:00 UTC');
  await expect(receipt.getByText('Synthetic invoice', { exact: true })).toHaveCount(0);
  await page.getByRole('radiogroup', { name: 'Display unit' }).getByRole('radio', { name: 'BTC', exact: true }).click();
  await expect(receipt.getByText('0.00003123456 BTC', { exact: true })).toBeVisible();
});

for (const kind of ['create_invoice', 'new_address'] as const) {
  test(`a long ${kind} copy field is complete, capped and usable above the fold at 390`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installSyntheticApi(page);
    const completed = operation(kind, 'succeeded', 'completed', true);
    const value = (kind === 'create_invoice' ? fixture('create_invoice_result').bolt11 : fixture('new_address_result').address).repeat(48);
    completed.result = kind === 'create_invoice' ? { ...fixture('create_invoice_result'), bolt11: value } : { ...fixture('new_address_result'), address: value };
    await stubClipboard(page);
    await page.route(`**/api/v1/nodes/lnd-lab/operations/${completed.id}`, route => route.fulfill({ json: completed }));
    await page.goto(`/nodes/lnd-lab/${kind === 'create_invoice' ? 'invoices' : 'onchain'}?operation=${completed.id}`);
    const dialog = page.getByRole('dialog', { name: kind === 'create_invoice' ? 'Create invoice' : 'New address', exact: true });
    const receipt = dialog.getByRole('region', { name: kind === 'create_invoice' ? 'Invoice receipt' : 'Address receipt' });
    const field = receipt.getByRole('region', { name: kind === 'create_invoice' ? 'Invoice value' : 'Address value', exact: true });
    const copy = receipt.getByRole('button', { name: kind === 'create_invoice' ? 'Copy Invoice' : 'Copy Address', exact: true });
    await expect(field).toBeVisible();
    expect(await field.textContent()).toBe(value);
    const dimensions = await field.evaluate(element => ({
      height: element.clientHeight, fullHeight: element.scrollHeight,
      width: element.clientWidth, fullWidth: element.scrollWidth,
      lineHeight: parseFloat(getComputedStyle(element).lineHeight),
    }));
    expect(dimensions.height).toBeLessThanOrEqual(dimensions.lineHeight * 5 + 1);
    expect(dimensions.fullHeight).toBeGreaterThan(dimensions.height);
    expect(dimensions.fullWidth).toBeLessThanOrEqual(dimensions.width + 1);
    await expect(copy).toBeVisible();
    await expect.poll(async () => {
      const box = await copy.boundingBox();
      return box !== null && box.y >= 0 && box.y + box.height <= 844;
    }).toBe(true);
    const body = dialog.locator('[data-ui="bottom-sheet-body"]');
    const visibleTargets = [copy, receipt.getByText(kind === 'create_invoice' ? 'Unpaid' : 'Created', { exact: true }), receipt.getByText(/^Created /)];
    if (kind === 'create_invoice') visibleTargets.push(receipt.getByText('2,500 sat', { exact: true }), receipt.getByText(/^Expires /));
    for (const target of visibleTargets) {
      const box = await target.boundingBox();
      if (!box) throw new Error('Missing receipt content');
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(844);
    }
    expect(await body.evaluate(element => element.scrollTop)).toBe(0);
    expect(await body.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await copy.click();
    expect(await page.locator('html').getAttribute('data-copied-value')).toBe(value);
  });
}

for (const kind of ['new_address', 'create_invoice'] as const) {
  test(`completed ${kind} keeps its result and timeline without node observation`, async ({ page }) => {
    await installSyntheticApi(page);
    const completed = operation(kind, 'succeeded', 'completed', true);
    await page.route(`**/api/v1/nodes/lnd-lab/operations/${completed.id}`, route => route.fulfill({ json: completed }));
    await page.goto(`/nodes/lnd-lab/operations/${completed.id}`);
    await expect(page.getByText(kind === 'new_address' ? 'Address created.' : 'Invoice created.', { exact: true })).toHaveCount(0);
    await expect(page.getByText(kind === 'new_address' ? 'Address created' : 'Invoice created', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Succeeded', { exact: true })).toHaveCount(0);
    const title = kind === 'new_address' ? 'Address operation' : 'Invoice operation';
    const heading = page.getByRole('heading', { name: title, exact: true });
    await expect(heading).toBeVisible();
    await expect(heading.locator('..')).toHaveText(title);
    await expect(page.getByRole('region', { name: 'Status', exact: true }).locator('dt').filter({ hasText: /^State$/ }).locator('xpath=following-sibling::dd[1]')).toHaveText('Created');
    await expect(page.getByText('Not checked with the node yet', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Last checked with the node', { exact: true })).toHaveCount(0);
    const value = kind === 'new_address' ? fixture('new_address_result').address : fixture('create_invoice_result').bolt11;
    await expect(page.getByRole('region', { name: kind === 'new_address' ? 'Address value' : 'Invoice value', exact: true })).toHaveText(value);
    await expect(page.getByRole('button', { name: kind === 'new_address' ? 'Copy Address' : 'Copy Invoice', exact: true })).toBeVisible();
    for (const label of ['Review created', 'Sent to node', 'Last state change', 'Final outcome']) {
      await expect(page.getByRole('list', { name: 'Operation timeline' }).getByRole('listitem').filter({ hasText: label })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Review', exact: true })).toBeVisible();
    if (kind === 'create_invoice') await expect(page.getByRole('heading', { name: 'Invoice details', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Technical details', exact: true }).click();
    await expect(page.getByText(fixture(`${kind}_review`).digest, { exact: true })).toBeVisible();
  });
}

test('a pending payment still shows its unobserved node check', async ({ page }) => {
  await installSyntheticApi(page);
  const pending = { ...operation('pay_invoice', 'pending', 'submitted'), last_reconciled_at: null };
  await page.route(`**/api/v1/nodes/lnd-lab/operations/${pending.id}`, route => route.fulfill({ json: pending }));
  await page.goto(`/nodes/lnd-lab/operations/${pending.id}`);
  await expect(page.getByRole('heading', { name: 'Payment operation', exact: true }).locator('..').getByText('Pending', { exact: true })).toBeVisible();
  await expect(page.getByText('In flight. The node has not reported a final outcome.', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Status', exact: true }).locator('dt').filter({ hasText: /^State$/ }).locator('xpath=following-sibling::dd[1]')).toHaveText('Pending');
  await expect(page.getByRole('heading', { name: 'Reviewed payment', exact: true })).toBeVisible();
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
