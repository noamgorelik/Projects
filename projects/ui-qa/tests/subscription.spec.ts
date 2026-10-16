import { test, expect } from '@playwright/test';
import type { Page, Request } from '@playwright/test';

const active = { subscription: { plan: 'Practice Plus', status: 'active' } };
const cancelled = {
  message: 'Subscription cancelled.',
  subscription: { plan: 'Practice Plus', status: 'cancelled' },
};
const unauthenticated = { error: 'UNAUTHENTICATED', message: 'Please sign in.' };

const account = (page: Page) => page.getByRole('region', { name: 'Your account', exact: true });
const subscription = (page: Page) => account(page).getByRole('region', { name: 'Your subscription', exact: true });
const confirmation = (page: Page) => subscription(page).getByRole('region', { name: 'Confirm cancellation', exact: true });

test.beforeEach(async ({ request }) => {
  const reset = await request.post('/api/test/reset-subscription');
  expect(reset.status()).toBe(204);
});

async function signIn(page: Page) {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('demo@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Practice123!');
  const loaded = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/subscription' &&
    response.request().method() === 'GET'
  );
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  expect((await loaded).status()).toBe(200);
  await expect(account(page).locator('#account-email')).toHaveText('demo@example.test');
  await expect(subscription(page).locator('#subscription-plan')).toHaveText('Practice Plus');
  await expect(subscription(page).locator('#subscription-status')).toHaveText('Active');
}

async function reloadSubscription(page: Page, status: string) {
  const loaded = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/subscription' &&
    response.request().method() === 'GET'
  );
  await page.reload();
  expect((await loaded).status()).toBe(200);
  await expect(subscription(page)).toBeVisible();
  await expect(subscription(page).locator('#subscription-status')).toHaveText(status);
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  )).toBe(true);
}

async function confirmCancellation(page: Page) {
  const cancel = subscription(page).getByRole('button', { name: 'Cancel subscription', exact: true });
  await expect(cancel).toBeVisible();
  await expect(cancel).toBeEnabled();
  await cancel.click();
  await expect(confirmation(page)).toBeVisible();
  await expect(confirmation(page).getByText(
    'Cancel Practice Plus immediately? This is fictional practice data. No payment will be taken or refunded.',
    { exact: true }
  )).toBeVisible();
  const confirm = confirmation(page).getByRole('button', { name: 'Confirm cancellation', exact: true });
  await expect(confirm).toBeVisible();
  await expect(confirm).toBeEnabled();
  await expectNoHorizontalOverflow(page);
  const completed = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/subscription/cancel' &&
    response.request().method() === 'POST'
  );
  await confirm.click();
  const response = await completed;
  expect(response.request().postDataJSON()).toEqual({ confirm: true });
  expect(response.status()).toBe(200);
  await expect(subscription(page).locator('#subscription-status')).toHaveText('Cancelled');
  await expect(subscription(page).locator('#subscription-message')).toHaveText('Subscription cancelled.');
  await expect(cancel).toBeHidden();
  await expect(confirmation(page)).toBeHidden();
}

test('signed-in account displays Practice Plus and Active', async ({ page, context }) => {
  await signIn(page);
  await expect(subscription(page)).toBeVisible();
  // This body assertion concerns a separate real API request.
  const response = await context.request.get('/api/subscription');
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual(active);
});

test('Keep subscription closes confirmation without cancelling', async ({ page, context }) => {
  await signIn(page);
  let cancellationRequests = 0;
  const observe = (request: Request) => {
    if (new URL(request.url()).pathname === '/api/subscription/cancel' && request.method() === 'POST') {
      cancellationRequests += 1;
    }
  };
  page.on('request', observe);
  try {
    await subscription(page).getByRole('button', { name: 'Cancel subscription', exact: true }).click();
    await expect(confirmation(page)).toBeVisible();
    await confirmation(page).getByRole('button', { name: 'Keep subscription', exact: true }).click();
    await expect(confirmation(page)).toBeHidden();
    await expect(subscription(page).locator('#subscription-status')).toHaveText('Active');
    await reloadSubscription(page, 'Active');
    const response = await context.request.get('/api/subscription');
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual(active);
    expect(cancellationRequests).toBe(0);
  } finally {
    page.off('request', observe);
  }
});

test('confirmed cancellation survives refresh and repeated cancellation', async ({ page, context }) => {
  await signIn(page);
  await confirmCancellation(page);
  await reloadSubscription(page, 'Cancelled');
  await expect(subscription(page).getByRole('button', { name: 'Cancel subscription', exact: true })).toBeHidden();
  // A separate API request verifies the stored state after the browser action.
  const current = await context.request.get('/api/subscription');
  expect(current.status()).toBe(200);
  expect(await current.json()).toEqual({ subscription: cancelled.subscription });
  const repeated = await context.request.post('/api/subscription/cancel', { data: { confirm: true } });
  expect(repeated.status()).toBe(200);
  expect(await repeated.json()).toEqual(cancelled);
});

test('unauthenticated subscription viewing and cancellation are rejected', async ({ request }) => {
  const viewing = await request.get('/api/subscription');
  expect(viewing.status()).toBe(401);
  expect(await viewing.json()).toEqual(unauthenticated);
  const cancellation = await request.post('/api/subscription/cancel', { data: { confirm: true } });
  expect(cancellation.status()).toBe(401);
  expect(await cancellation.json()).toEqual(unauthenticated);
});

test('cancellation works at a 390 by 844 viewport without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await expectNoHorizontalOverflow(page);
  // The helper's real clicks also check that both controls can be operated.
  await confirmCancellation(page);
  await expectNoHorizontalOverflow(page);
  await reloadSubscription(page, 'Cancelled');
  await expect(subscription(page).locator('#subscription-plan')).toHaveText('Practice Plus');
  await expect(subscription(page).getByRole('button', { name: 'Cancel subscription', exact: true })).toBeHidden();
  await expectNoHorizontalOverflow(page);
});
