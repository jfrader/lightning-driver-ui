import { expect, test } from '@playwright/test';
import { installSyntheticApi, operation } from './synthetic-api';

const SESSION_ENDED = {
  error: {
    code: 'session_required',
    message: 'Session ended.',
    request_id: '00000000-0000-4000-8000-000000000601',
    operation_id: null,
    outcome: 'not_dispatched',
  },
};

test('a 401 on the explicit low-risk confirm signs out instead of showing node data', async ({ page }) => {
  const requests = await installSyntheticApi(page);
  await page.route('**/api/v1/nodes/*/operations/*/confirm', (route) => {
    const request = route.request();
    requests.push({
      method: request.method(),
      path: new URL(request.url()).pathname.replace('/api/v1', ''),
      body: request.postDataJSON(),
    });
    return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify(SESSION_ENDED) });
  });
  await page.goto('/nodes/lnd-lab/invoices/new');
  await page.getByLabel(/^Amount \(sat\)/).click();
  await page.keyboard.type('2500');

  // The local-result form creates and confirms with one action.
  await page.getByRole('dialog', { name: 'Create invoice', exact: true }).getByRole('button', { name: 'Create invoice', exact: true }).click();

  await expect(page).toHaveURL(/\/login\?redirect=/);
  await expect(page.getByRole('button', { name: 'Continue with passkey' })).toBeVisible();
  await expect(page.getByText('Open the review')).toHaveCount(0);
  await expect(page.getByText('LND lab')).toHaveCount(0);
  expect(requests.map((r) => r.path)).toEqual([
    '/nodes/lnd-lab/operations',
    `/nodes/lnd-lab/operations/${operation('create_invoice').id}/confirm`,
  ]);
});
