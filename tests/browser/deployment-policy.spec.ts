import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { installSyntheticApi } from './synthetic-api';

test('the production UI works under the documented CSP and blocks inline scripts', async ({ page }) => {
  const policy = readFileSync('README.md', 'utf8').match(/^Content-Security-Policy: (.+)$/m)?.[1];
  expect(policy).toBeTruthy();
  const violations: string[] = [];
  page.on('console', message => {
    if (message.text().startsWith('CSP:')) violations.push(message.text());
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', event => console.warn(`CSP:${event.effectiveDirective}`));
  });
  await installSyntheticApi(page);
  await page.route('**/*', async route => {
    if (!route.request().isNavigationRequest()) return route.fallback();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': policy! } });
  });
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Continue with passkey' })).toBeVisible();
  await page.goto('/nodes/lnd-lab');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Balances', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /^On-chain composition:/ }).locator('svg')).toBeVisible();
  await page.goto('/more');
  await page.route('**/api/v1/session', route => route.request().method() === 'DELETE' ? route.abort() : route.fallback());
  await page.getByRole('region', { name: 'Session', exact: true }).getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByText('Session revocation failed. Retry sign out.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Session', exact: true })).toHaveCount(0);
  await expect(page.getByText('Signed out.')).toHaveCount(0);
  await page.route('**/api/v1/session', route => route.request().method() === 'DELETE' ? route.fulfill({ status: 204 }) : route.fallback());
  await page.getByRole('button', { name: 'Retry sign out' }).click();
  await expect(page.getByText('Signed out.')).toBeVisible();
  expect(violations).toEqual([]);
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.inlineScriptRan = true';
    document.body.append(script);
  });
  await expect.poll(() => violations).toContain('CSP:script-src-elem');
  expect(await page.evaluate(() => Reflect.get(window, 'inlineScriptRan'))).toBeUndefined();
});
