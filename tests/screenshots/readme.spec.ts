import { expect, test, type Page } from '@playwright/test';
import examples from '../../contract/examples.v1.json' with { type: 'json' };
import { installSyntheticApi, type SyntheticOptions, operation } from '../browser/synthetic-api';

/**
 * The committed README images. Every screen is served the frozen contract fixtures, so the captures
 * show the real components with the backend's own example data; `npm run screenshots` rewrites them.
 */
const OUTPUT = 'docs/screenshots';

const NODE_ID = examples.fixtures.node_lnd.value.id;
const CHANNEL_ID = examples.fixtures.channels_page.value.items[0].id;
const PAY_REVIEW = `/nodes/${NODE_ID}/operations/${operation('pay_invoice').id}`;

/** The fixtures' sentinel alias and version are test markers; the captures read as demo data. */
const DEMO: SyntheticOptions = { nodeInfo: { alias: 'LND lab', version: '0.19.3-beta' } };

const DESKTOP = { width: 1440, height: 1000 };
const PHONE = { width: 390, height: 844 };

/** The preview server this run started; the synthetic API aborts everything outside it. */
const appOrigin = () => test.info().project.use.baseURL as string;

test.beforeEach(async ({ page }) => {
  await installSyntheticApi(page, appOrigin(), DEMO);
});

async function capture(page: Page, path: string, name: string) {
  await page.goto(path);
  await expect(page.getByRole('main')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUTPUT}/${name}.png`, animations: 'disabled', caret: 'hide' });
}

test.describe('desktop', () => {
  test.use({ viewport: DESKTOP });

  test('node overview', async ({ page }) => {
    await capture(page, `/nodes/${NODE_ID}`, 'overview');
  });

  test('channels with the inspector open', async ({ page }) => {
    await capture(page, `/nodes/${NODE_ID}/channels?selected=${CHANNEL_ID}`, 'channels');
  });

  test('operation review', async ({ page }) => {
    await capture(page, PAY_REVIEW, 'review');
  });
});

test.describe('phone', () => {
  test.use({ viewport: PHONE });

  test('channels as cards', async ({ page }) => {
    await capture(page, `/nodes/${NODE_ID}/channels`, 'phone-channels');
  });
});
