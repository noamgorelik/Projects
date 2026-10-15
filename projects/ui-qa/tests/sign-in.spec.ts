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
