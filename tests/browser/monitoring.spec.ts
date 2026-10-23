import { expect, test, type Page } from '@playwright/test';
import { installMonitoringApi } from './monitoring-api';
import { fixture } from './synthetic-api';

async function doubleText(page: Page) {
  await page.evaluate(() => {
    const sizes = [...document.body.querySelectorAll<HTMLElement>('*')].map((element) => ({
      element,
      font: parseFloat(getComputedStyle(element).fontSize),
      line: parseFloat(getComputedStyle(element).lineHeight),
    }));
    for (const { element, font, line } of sizes) {
      element.style.setProperty('font-size', `${font * 2}px`, 'important');
      if (Number.isFinite(line)) element.style.setProperty('line-height', `${line * 2}px`, 'important');
    }
  });
}

test('Bitcoin workspace has monitoring sections, peers and no Lightning actions', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/nodes/')) requests.push(new URL(request.url()).pathname);
  });
  const mutations = await installMonitoringApi(page);
  await page.goto('/nodes/bitcoin-lab');
  await expect(page.getByRole('heading', { name: 'Bitcoin Core lab' })).toBeVisible();
  for (const name of ['Needs attention', 'Chain', 'Network', 'Mempool', 'Storage', 'Node details']) {
    await expect(page.getByRole('main').getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByText('Monitor only', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('9,007,199,254,740,993 bytes')).toBeVisible();
  const nav = page.getByRole('navigation', {
    name: (page.viewportSize()?.width ?? 0) < 1024 ? 'Sections' : 'Node sections',
  });
  await expect(nav.getByRole('link', { name: 'Peers', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Channels', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'View peers' }).click();
  await expect(page.getByRole('heading', { name: 'Peers', exact: true })).toBeVisible();
  await page.locator('[data-row-primary]').click();
  await expect(page.getByText('Connected since', { exact: true })).toBeVisible();
  await page.goto('/nodes/bitcoin-lab/peers?selected=1');
  await expect(page.getByText('Connected since', { exact: true })).toBeVisible();
  await expect(page.getByText('Not reported', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Connect peer', exact: true })).toHaveCount(0);
  expect(requests.some((path) => /\/(balances|payments|policy|info)$/.test(path))).toBe(false);
  expect(mutations).toEqual([]);
});

test('Bitcoin IBD stays Online with progress; mismatch names both networks', async ({ page }) => {
  await installMonitoringApi(page, { syncing: true, mismatch: true });
  await page.goto('/nodes/bitcoin-lab');
  await expect(page.getByText('Online', { exact: true })).toBeVisible();
  await expect(page.getByText('Syncing · 23.45%', { exact: true })).toBeVisible();
  await expect(page.getByText('Network mismatch', { exact: true })).toBeVisible();
  await expect(page.getByText('Expected Testnet4 · Reported Mainnet')).toBeVisible();
});

test('Bitcoin fleet row is monitor only with no actions or unresolved count', async ({ page }) => {
  await installMonitoringApi(page);
  await page.goto('/fleet');
  const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'Bitcoin Core lab', exact: true }) });
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    await expect(row.getByText('Monitor only', { exact: true })).toBeVisible();
    await expect(row.getByText('None', { exact: true })).toBeVisible();
    await expect(row.getByText('—', { exact: true })).toBeVisible();
  } else await expect(page.getByText('Monitor only', { exact: true })).toBeVisible();
});

for (const path of [
  '/payments',
  '/channels',
  '/onchain',
  '/operations',
  '/peers/new',
  '/watchtower',
  '/watchtower/server',
]) {
  test(`Bitcoin unsupported deep link ${path} has its node header and Overview link`, async ({ page }) => {
    await installMonitoringApi(page);
    await page.goto(`/nodes/bitcoin-lab${path}`);
    await expect(page.getByRole('heading', { name: 'Bitcoin Core lab' })).toBeVisible();
    await expect(page.getByText('Not available for this node', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Back to Overview' }).click();
    await expect(page.getByRole('heading', { name: 'Mempool', exact: true })).toBeVisible();
  });
}

test('watchtower client shows backups, policy and tower sessions with truncation', async ({ page }) => {
  const mutations = await installMonitoringApi(page, { truncated: true });
  await page.goto('/nodes/lnd-lab/watchtower');
  await expect(page.getByRole('heading', { name: 'Watchtower client', exact: true })).toBeVisible();
  await expect(page.getByText('Since startup', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Policy', exact: true })).toBeVisible();
  await page.locator('[data-row-primary]').click();
  await expect(page.getByRole('heading', { name: 'Anchor sessions', exact: true })).toBeVisible();
  await expect(page.getByText('Sessions truncated', { exact: true })).toBeVisible();
  await expect(
    page.getByText(fixture('watchtower_tower_detail').session_info[0].sessions[0].id, { exact: true }),
  ).toBeVisible();
  expect(mutations).toEqual([]);
});

test('watchtower server shows identity, listeners and URIs without clients', async ({ page }) => {
  const mutations = await installMonitoringApi(page);
  await page.goto('/nodes/lnd-lab/watchtower/server');
  await expect(page.getByRole('heading', { name: 'Watchtower server', exact: true })).toBeVisible();
  await expect(page.getByText('Serving', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy public key', exact: true })).toBeVisible();
  for (const name of ['Identity', 'Listeners', 'URIs'])
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Clients', exact: true })).toHaveCount(0);
  expect(mutations).toEqual([]);
});

test('unavailable watchtower roles are guarded without reading their endpoints', async ({ page }) => {
  await installMonitoringApi(page, { denied: true });
  const reads: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/nodes/lnd-lab/watchtower')) reads.push(request.url());
  });
  for (const suffix of ['', '/server']) {
    await page.goto(`/nodes/lnd-lab/watchtower${suffix}`);
    await expect(page.getByText('Not available for this node', { exact: true })).toBeVisible();
  }
  expect(reads).toEqual([]);
});

test('offline Bitcoin retains configured peer navigation', async ({ page }) => {
  await installMonitoringApi(page, { offline: true, error: true });
  await page.goto('/nodes/bitcoin-lab');
  await expect(page.getByText('Offline', { exact: true })).toBeVisible();
  const nav = page.getByRole('navigation', {
    name: (page.viewportSize()?.width ?? 0) < 1024 ? 'Sections' : 'Node sections',
  });
  await expect(nav.getByRole('link', { name: 'Peers', exact: true })).toBeVisible();
});

test('Lightning overview actions and reads agree with unavailable surfaces', async ({ page }) => {
  await installMonitoringApi(page, { restricted: true });
  const reads: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/nodes/lnd-lab/')) reads.push(new URL(request.url()).pathname);
  });
  await page.goto('/nodes/lnd-lab');
  await expect(page.getByRole('heading', { name: 'Balances', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pay invoice', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Receive', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent payments', exact: true })).toHaveCount(0);
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Go to' });
  for (const name of ['Payments', 'Pay invoice…', 'Unresolved operations']) {
    await expect(palette.getByRole('option', { name, exact: true })).toHaveCount(0);
  }
  await page.keyboard.press('Escape');
  await page.goto('/nodes/lnd-lab/payments');
  await expect(page.getByText('Not available for this node', { exact: true })).toBeVisible();
  expect(reads.filter((path) => /\/(payments|operations)$/.test(path))).toEqual([]);
});

test('palette agrees with Bitcoin surfaces and phone More preserves the peer tab', async ({ page }) => {
  await installMonitoringApi(page);
  await page.goto('/nodes/bitcoin-lab');
  await expect(page.getByRole('heading', { name: 'Mempool', exact: true })).toBeVisible();
  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Go to' });
  await expect(palette.getByRole('option', { name: 'Peers', exact: true })).toBeVisible();
  await expect(palette.getByRole('option', { name: 'Channels', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'More' }).click();
    await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Peers' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Peers' })).toBeVisible();
  }
});

test('chooser preserves a shared surface and falls back to Overview for a missing surface', async ({ page }) => {
  await installMonitoringApi(page);
  await page.goto('/nodes/lnd-lab/peers');
  const chooser = page.getByRole('combobox', { name: 'Node' });
  await chooser.click();
  await page.getByRole('option', { name: /Bitcoin Core lab/ }).click();
  await expect(page).toHaveURL(/\/nodes\/bitcoin-lab\/peers$/);
  await chooser.click();
  await page.getByRole('option', { name: /LND lab/ }).click();
  await expect(page).toHaveURL(/\/nodes\/lnd-lab\/peers$/);
  await page.goto('/nodes/lnd-lab/watchtower/server');
  await page.getByRole('combobox', { name: 'Node' }).click();
  await page.getByRole('option', { name: /Bitcoin Core lab/ }).click();
  await expect(page).toHaveURL(/\/nodes\/bitcoin-lab$/);
  await expect(page.getByRole('heading', { name: 'Mempool', exact: true })).toBeVisible();
});

test('@layout monitoring inspectors have no document overflow and their controls clear the phone tabs', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
  await installMonitoringApi(page, { long: true, truncated: true });
  const tower = fixture('watchtower_tower_detail').pubkey;
  for (const path of [
    '/nodes/bitcoin-lab',
    '/nodes/bitcoin-lab/peers?selected=1',
    `/nodes/lnd-lab/watchtower?selected=${tower}`,
    '/nodes/lnd-lab/watchtower/server',
  ]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    ).toBeLessThanOrEqual(1);
    for (const control of await page.locator('main a, main button').all()) {
      if (!(await control.isVisible())) continue;
      await control.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest' }));
      const result = await control.evaluate((element) => {
        const target = element.hasAttribute('data-row-primary') ? (element.closest('li') ?? element) : element;
        const rect = target.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return {
          width: rect.width,
          height: rect.height,
          onTop: Boolean(hit && (hit === element || element.contains(hit) || target.contains(hit))),
        };
      });
      expect(result.onTop).toBe(true);
      if ((page.viewportSize()?.width ?? 0) < 768) {
        expect(result.width).toBeGreaterThanOrEqual(44);
        expect(result.height).toBeGreaterThanOrEqual(44);
      }
    }
  }
});

test('@layout phone tab text fits its targets at 200% text size', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await installMonitoringApi(page);
  await page.goto('/nodes/bitcoin-lab');
  await expect(page.getByRole('heading', { name: 'Mempool', exact: true })).toBeVisible();
  await doubleText(page);
  const labels = await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('link')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const text = range.getBoundingClientRect();
        const target = element.getBoundingClientRect();
        return {
          text: element.textContent,
          bounds: text.toJSON(),
          target: target.toJSON(),
          whiteSpace: getComputedStyle(element).whiteSpace,
          fits:
            text.left >= target.left &&
            text.right <= target.right + 1 &&
            text.top >= target.top &&
            text.bottom <= target.bottom + 1,
        };
      }),
    );
  expect(
    labels.every((label) => label.fits),
    JSON.stringify(labels),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const observed = await page.getByRole('main').getByText('Observed 1 minute ago', { exact: true }).boundingBox();
  const tabs = await page.getByRole('navigation', { name: 'Sections' }).boundingBox();
  expect(observed && tabs && observed.y + observed.height <= tabs.y - 12).toBe(true);
});

test('@layout enlarged Bitcoin peer tables scroll inside the workspace', async ({ page }) => {
  await installMonitoringApi(page, { long: true });
  for (const width of [768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/nodes/bitcoin-lab/peers?selected=1');
    await expect(page.getByRole('heading', { name: 'Peer', exact: true })).toBeVisible();
    await doubleText(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    ).toBeLessThanOrEqual(1);
    const scrollsInside = await page.getByRole('table', { name: 'Bitcoin peers' }).evaluate((table) => {
      for (let ancestor = table.parentElement; ancestor; ancestor = ancestor.parentElement) {
        if (
          ['auto', 'scroll'].includes(getComputedStyle(ancestor).overflowX) &&
          ancestor.scrollWidth > ancestor.clientWidth
        )
          return true;
      }
      return false;
    });
    expect(scrollsInside).toBe(true);
  }
});
