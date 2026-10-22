import { expect, test, type Page } from '@playwright/test';
import examples from '../../contract/examples.v1.json' with { type: 'json' };
import { fixture, installSyntheticApi, operation, unresolvedOperation } from './synthetic-api';

/** The phone review's primary action must clear the fixed tab bar by at least this much. */
const TAB_BAR_CLEARANCE_PX = 12;
const REVIEW_PATH = `/nodes/lnd-lab/operations/${operation('pay_invoice').id}`;
const PAYMENT_HASH = examples.fixtures.payments_page.value.items[0].payment_hash;
const BALANCES = examples.fixtures.balances.value;

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;

test('an unknown operation shows the withheld check on overview and detail', async ({ page }) => {
  await installSyntheticApi(page);
  const unknown = {
    ...unresolvedOperation(),
    reconciliation: {
      attempts: 1,
      last_attempt_at: '2026-10-21T12:00:30Z',
      next_attempt_at: '2026-10-21T12:02:00Z',
      last_outcome: 'withheld',
      exhausted: false,
    },
  };
  await page.route('**/api/v1/nodes/lnd-lab/operations**', (route) => route.fulfill({
    json: new URL(route.request().url()).pathname.endsWith(unknown.id)
      ? unknown
      : { ...fixture('operations_page'), node_id: unknown.node_id, network: unknown.review.node.network, items: [unknown] },
  }));
  await page.goto('/nodes/lnd-lab');
  await expect(page.getByText('The node could not be reached.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'View operation', exact: true }).click();
  await expect(page).toHaveURL(`/nodes/lnd-lab/operations/${unknown.id}`);
  await expect(page.getByText('The node could not be reached.', { exact: true })).toBeVisible();
});

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const SIZES = [
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1440, height: 900 },
];

for (const path of ['/nodes/lnd-lab', `/nodes/lnd-lab/payments?selected=${PAYMENT_HASH}`, REVIEW_PATH]) {
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

test('the phone review primary action sits at least 12px above the tab bar', async ({ page }) => {
  test.skip(!isPhone(page), 'phone shell only');
  await installSyntheticApi(page);
  await page.goto(REVIEW_PATH);
  const pay = page.getByRole('button', { name: 'Pay with passkey' });
  await expect(pay).toBeVisible();

  const tabs = await page.getByRole('navigation', { name: 'Sections' }).boundingBox();
  const action = await pay.boundingBox();
  if (!tabs || !action) throw new Error('Missing geometry');
  expect(action.y + action.height).toBeLessThan(tabs.y - TAB_BAR_CLEARANCE_PX);
});

test('the full recipient wraps inside the consent block without clipping', async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto(REVIEW_PATH);
  const recipient = page.getByTitle(operation('pay_invoice').review.destination ?? '');
  await expect(recipient).toBeVisible();
  await expect(recipient).toHaveText(operation('pay_invoice').review.destination ?? '');

  const geometry = await recipient.evaluate((element) => {
    const block = element.closest('dd');
    const box = element.getBoundingClientRect();
    const container = block?.getBoundingClientRect();
    const groupTops = new Set(Array.from(element.children).map((group) => Math.round(group.getBoundingClientRect().top)));
    return {
      clipped: element.scrollWidth > element.clientWidth,
      overflowsBlock: container ? box.right > container.right + 0.5 : true,
      lines: groupTops.size,
    };
  });
  expect(geometry.clipped).toBe(false);
  expect(geometry.overflowsBlock).toBe(false);
  if (isPhone(page)) expect(geometry.lines).toBeGreaterThan(1);
});

test('composition bars match the exact fixture ratios', async ({ page }) => {
  await installSyntheticApi(page);
  await page.goto('/nodes/lnd-lab');
  const cases = [
    {
      name: /On-chain composition/,
      first: BigInt(BALANCES.onchain_confirmed_sat),
      second: BigInt(BALANCES.onchain_unconfirmed_sat),
    },
    {
      name: /Lightning channels composition/,
      first: BigInt(BALANCES.channel_local_msat),
      second: BigInt(BALANCES.channel_remote_msat),
    },
  ];
  for (const { name, first, second } of cases) {
    const bar = page.getByRole('img', { name });
    await expect(bar.locator('path.recharts-rectangle')).toHaveCount(2);
    const { frame, widths } = await bar.evaluate((element) => ({
      frame: element.getBoundingClientRect().width,
      widths: Array.from(element.querySelectorAll<SVGGraphicsElement>('path.recharts-rectangle')).map(
        (segment) => segment.getBBox().width,
      ),
    }));
    const expected = Number((first * 1_000_000n) / (first + second)) / 1_000_000;
    // One pixel of the frame is the tolerance: geometry is a float, the printed shares are exact.
    expect(Math.abs(widths[0] / frame - expected)).toBeLessThan(1 / frame + 1e-6);
    expect(Math.abs(widths[0] + widths[1] - frame)).toBeLessThanOrEqual(1);
  }
});

test('the chart module loads only when a chart renders', async ({ page }) => {
  await installSyntheticApi(page);
  const chartRequests: string[] = [];
  page.on('request', (request) => {
    if (/ShareBarChart/.test(request.url())) chartRequests.push(request.url());
  });
  await page.goto('/nodes/lnd-lab/payments');
  await expect(page.getByRole('heading', { name: 'Payments', level: 2 })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(chartRequests).toEqual([]);
  const html = await (await page.request.get('/')).text();
  expect(html).not.toMatch(/ShareBarChart/);

  const nav = isPhone(page) ? 'Sections' : 'Node sections';
  await page.getByRole('navigation', { name: nav }).getByRole('link', { name: 'Overview' }).click();
  await expect(page.getByRole('img', { name: /On-chain composition/ }).locator('svg')).toBeVisible();
  expect(chartRequests.length).toBe(1);
});
