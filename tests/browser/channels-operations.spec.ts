import { expect, test, type Page } from '@playwright/test';
import { UNRESOLVED_OPERATION_ID, fixture, installSyntheticApi, operation, syntheticChannels } from './synthetic-api';
import { doubleText } from './text-size';

const OPERATION_PATH = `/nodes/lnd-lab/operations/${UNRESOLVED_OPERATION_ID}`;
const SIZES = [
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1440, height: 900 },
];

test('historical-node navigation has usable phone targets and still opens the journal and fleet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installSyntheticApi(page);
  const formerId = 'retired-lnd';
  const former = operation('pay_invoice', 'unknown', 'reconciling');
  former.node_id = formerId;
  former.review.node.node_id = formerId;
  await page.route(`**/api/v1/nodes/${formerId}/operations**`, route => route.fulfill({
    json: new URL(route.request().url()).pathname.endsWith(former.id)
      ? former
      : { ...fixture('operations_page'), node_id: formerId, network: 'regtest', next_cursor: null, items: [former] },
  }));
  for (const enlarged of [false, true]) {
    await page.goto(`/nodes/${formerId}/operations/${former.id}`);
    await expect(page.getByText('This node is not configured', { exact: true })).toBeVisible();
    if (enlarged) await doubleText(page);
    for (const name of ['Operation history', 'Fleet']) {
      const action = page.getByRole('link', { name, exact: true });
      const box = await action.boundingBox();
      if (!box) throw new Error('Missing historical-node action');
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('link', { name: 'Operation history', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Operations', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Fleet', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Fleet', exact: true })).toBeVisible();
  }
});

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

for (const path of ['/nodes/lnd-lab/channels?selected=channel-synthetic-remainder', '/nodes/lnd-lab/operations', OPERATION_PATH]) {
  test(`${path} has no horizontal overflow at 390, 768 and 1440`, async ({ page }) => {
    await installSyntheticApi(page);
    for (const size of SIZES) {
      await page.setViewportSize(size);
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      await page.waitForLoadState('networkidle');
      await expectNoHorizontalOverflow(page);
    }
  });
}

test('liquidity bars match the exact fixture ratios, remainder included, and none is drawn without balances', async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto('/nodes/lnd-lab/channels');
  const [plain, opening, withRemainder] = syntheticChannels();
  const cases = [
    { name: /^Liquidity of channel cccccccc…:0:/, channel: plain },
    { name: /^Liquidity of channel 812x1x0:/, channel: withRemainder },
  ];
  await expect(page.getByRole('img', { name: /^Liquidity of channel/ })).toHaveCount(2);
  await expect(page.getByText('Balances not reported')).toHaveCount(1);
  expect(opening.local_msat).toBeNull();

  for (const { name, channel } of cases) {
    const capacity = BigInt(channel.capacity_sat ?? '0') * 1000n;
    const local = BigInt(channel.local_msat ?? '0');
    const remote = BigInt(channel.remote_msat ?? '0');
    const parts = [local, remote, capacity - local - remote].filter((part) => part > 0n);
    const bar = page.getByRole('img', { name });
    await expect(bar.locator('path.recharts-rectangle')).toHaveCount(parts.length);
    const { frame, widths } = await bar.evaluate((element) => ({
      frame: element.getBoundingClientRect().width,
      widths: Array.from(element.querySelectorAll<SVGGraphicsElement>('path.recharts-rectangle')).map(
        (segment) => segment.getBBox().width,
      ),
    }));
    parts.forEach((part, index) => {
      const expected = Number((part * 1_000_000n) / capacity) / 1_000_000;
      // One pixel of the frame is the tolerance: geometry is a float, the printed amounts are exact.
      expect(Math.abs(widths[index] / frame - expected)).toBeLessThan(1 / frame + 1e-6);
    });
    expect(Math.abs(widths.reduce((sum, width) => sum + width, 0) - frame)).toBeLessThanOrEqual(1);
  }
});

test('the operation timeline says what was not recorded or not observed', async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto(OPERATION_PATH);
  const timeline = page.getByRole('list', { name: 'Operation timeline' });
  await expect(timeline.getByRole('listitem')).toHaveCount(6);
  await expect(timeline.getByRole('listitem').nth(0)).toContainText('Review created');
  await expect(timeline.getByRole('listitem').nth(0)).toContainText('12:00:00 UTC');
  await expect(timeline.getByRole('listitem').nth(1)).toContainText('Time not recorded');
  await expect(timeline.getByRole('listitem').nth(2)).toContainText('Time not recorded');
  await expect(timeline.getByRole('listitem').nth(4)).toContainText('12:00:30 UTC');
  await expect(timeline.getByRole('listitem').nth(5)).toContainText('Not observed yet');
});

test('an unresolved operation offers no retry, payment or confirmation control', async ({ page }) => {
  const requests = await installSyntheticApi(page);
  await page.goto(OPERATION_PATH);
  await expect(page.getByRole('heading', { name: 'Payment operation' })).toBeVisible();
  const buttons = await page.getByRole('main').getByRole('button').allTextContents();
  for (const name of buttons) expect(name).not.toMatch(/pay|retry|again|confirm|passkey|resend/i);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+Enter');
  expect(requests.filter((request) => request.path.includes('/operations'))).toEqual([]);
});

test('attention items open the operation detail directly', async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto('/nodes/lnd-lab');
  await page.getByRole('region', { name: 'Needs attention' }).getByRole('link', { name: 'View operation' }).click();
  await expect(page).toHaveURL(new RegExp(`${OPERATION_PATH}$`));
  await expect(page.getByRole('heading', { name: 'Payment operation' })).toBeVisible();
});
