import { test, expect } from '@playwright/test';

test('correct credentials show a successful sign-in', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('demo@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Practice123!');

  // Register the response wait before submitting so a fast response is captured.
  const loginResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/login' &&
    response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const response = await loginResponse;

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    message: 'Sign-in successful.',
    user: { email: 'demo@example.test' },
  });
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Sign-in successful.');
});

test('incorrect credentials show the invalid-credentials message', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('demo@example.test');
  await page.getByLabel('Password', { exact: true }).fill('WrongPassword!');

  const loginResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/login' &&
    response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const response = await loginResponse;

  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({
    error: 'INVALID_CREDENTIALS',
    message: 'Email or password is incorrect.',
  });
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Email or password is incorrect.');
});

test('refresh preserves sign-in', async ({ page, context }) => {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('demo@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Practice123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  const account = page.getByRole('region', { name: 'Your account', exact: true });
  await expect(account).toBeVisible();
  await expect(account.locator('#account-email')).toHaveText('demo@example.test');

  const meResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/me' &&
    response.request().method() === 'GET'
  );
  await page.reload();
  const response = await meResponse;
  expect(response.status()).toBe(200);
  await expect(account).toBeVisible();
  await expect(account.locator('#account-email')).toHaveText('demo@example.test');

  // This separate API request verifies the account body using the same cookie jar.
  const me = await context.request.get('/api/me');
  expect(me.status()).toBe(200);
  expect(await me.json()).toEqual({ user: { email: 'demo@example.test' } });
});

test('sign-out ends account access', async ({ page, context }) => {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('demo@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Practice123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  const account = page.getByRole('region', { name: 'Your account', exact: true });
  const form = page.locator('#sign-in-form');
  await expect(account).toBeVisible();
  await expect(account.locator('#account-email')).toHaveText('demo@example.test');

  // Keep the identifier in memory only; never log or attach it to the report.
  const session = (await context.cookies()).find((cookie) => cookie.name === 'practice_session');
  if (!session) throw new Error('Expected a practice session cookie after sign-in.');
  const savedSessionId = session.value;

  const logoutResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/logout' &&
    response.request().method() === 'POST'
  );
  await account.getByRole('button', { name: 'Sign out', exact: true }).click();
  const response = await logoutResponse;
  expect(response.status()).toBe(204);
  await expect(form).toBeVisible();
  await expect(account).toBeHidden();
  expect((await context.cookies()).some((cookie) => cookie.name === 'practice_session')).toBe(false);

  // Send the deleted cookie explicitly to prove server-side invalidation.
  const replay = await context.request.get('/api/me', {
    headers: { Cookie: `practice_session=${savedSessionId}` },
  });
  expect(replay.status()).toBe(401);
  expect(await replay.json()).toEqual({
    error: 'UNAUTHENTICATED',
    message: 'Please sign in.',
  });

  const meResponse = page.waitForResponse((result) =>
    new URL(result.url()).pathname === '/api/me' &&
    result.request().method() === 'GET'
  );
  await page.reload();
  const me = await meResponse;
  expect(me.status()).toBe(401);
  await expect(form).toBeVisible();
  await expect(account).toBeHidden();

  // This checks repeated logout while already signed out, not the click response.
  const repeatedLogout = await context.request.post('/api/logout');
  expect(repeatedLogout.status()).toBe(204);
  expect(await repeatedLogout.text()).toBe('');
});

test('a fresh browser cannot access account information', async ({ page, context }) => {
  // Playwright provides a new, unauthenticated context for every test.
  expect((await context.cookies()).length).toBe(0);
  const meResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/me' &&
    response.request().method() === 'GET'
  );
  await page.goto('/');
  const response = await meResponse;
  expect(response.status()).toBe(401);
  await expect(page.locator('#sign-in-form')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Your account', exact: true })).toBeHidden();

  // Verify the exact body in a separate real API request.
  const me = await context.request.get('/api/me');
  expect(me.status()).toBe(401);
  expect(await me.json()).toEqual({
    error: 'UNAUTHENTICATED',
    message: 'Please sign in.',
  });
});
