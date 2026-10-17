import { test, expect } from '@playwright/test';
import type { APIRequestContext, APIResponse } from '@playwright/test';

const credentials = { email: 'demo@example.test', password: 'Practice123!' };
const user = { email: 'demo@example.test' };
const loginSuccess = { message: 'Sign-in successful.', user };
const unauthenticated = { error: 'UNAUTHENTICATED', message: 'Please sign in.' };
const active = { subscription: { plan: 'Practice Plus', status: 'active' } };
const cancelled = { subscription: { plan: 'Practice Plus', status: 'cancelled' } };
const cancellationSuccess = { message: 'Subscription cancelled.', ...cancelled };

async function expectJson(response: APIResponse, status: number, body: unknown) {
  expect(response.status()).toBe(status);
  expect(await response.json()).toEqual(body);
}

async function signIn(request: APIRequestContext) {
  const response = await request.post('/api/login', { data: credentials });
  await expectJson(response, 200, loginSuccess);
  return response;
}

// The request fixture has a fresh cookie jar for each independent test.
test.beforeEach(async ({ request }) => {
  const reset = await request.post('/api/test/reset-subscription');
  expect(reset.status()).toBe(204);
});

test('health returns the exact server status', async ({ request }) => {
  await expectJson(await request.get('/health'), 200, { status: 'ok' });
});

test('correct login returns the account and expected session cookie attributes', async ({ request }) => {
  const response = await signIn(request);
  const state = await request.storageState();
  const cookie = state.cookies.find((item) => item.name === 'practice_session');
  if (!cookie) throw new Error('Expected a practice session cookie after sign-in.');
  // Assert individual attributes without exposing the identifier in failure output.
  expect(cookie.value.length > 0).toBe(true);
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe('Lax');
  expect(cookie.path).toBe('/');
  expect(cookie.secure).toBe(false); // This is the local HTTP demonstration.
  expect(cookie.domain).toBe('127.0.0.1');
  const attributes = (response.headers()['set-cookie'] ?? '').split(';').slice(1).map((part) => part.trim());
  expect(attributes.includes('Max-Age=3600')).toBe(true);
  expect(attributes.some((part) => part.startsWith('Expires='))).toBe(true);
  expect(cookie.expires > Date.now() / 1000).toBe(true);
});

test('incorrect password returns the exact credentials error', async ({ request }) => {
  const response = await request.post('/api/login', {
    data: { ...credentials, password: 'WrongPassword!' },
  });
  await expectJson(response, 401, {
    error: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.',
  });
});

test('missing password returns the exact input error', async ({ request }) => {
  const response = await request.post('/api/login', { data: { email: user.email } });
  await expectJson(response, 400, {
    error: 'INVALID_INPUT', message: 'Provide a valid email address and a non-empty password.',
  });
});

test('malformed JSON returns the exact parsing error', async ({ request }) => {
  const response = await request.post('/api/login', {
    headers: { 'Content-Type': 'application/json' },
    data: '{"email":"demo@example.test",}',
  });
  await expectJson(response, 400, {
    error: 'INVALID_JSON', message: 'Send a valid JSON request body.',
  });
});

test('account without a session returns the exact authentication error', async ({ request }) => {
  await expectJson(await request.get('/api/me'), 401, unauthenticated);
});

test('account with a valid session returns the exact account', async ({ request }) => {
  await signIn(request);
  await expectJson(await request.get('/api/me'), 200, { user });
});

test('unauthenticated subscription viewing and cancellation are rejected', async ({ request }) => {
  await expectJson(await request.get('/api/subscription'), 401, unauthenticated);
  const response = await request.post('/api/subscription/cancel', { data: { confirm: true } });
  await expectJson(response, 401, unauthenticated);
});

test('authenticated subscription lookup returns Active', async ({ request }) => {
  await signIn(request);
  await expectJson(await request.get('/api/subscription'), 200, active);
});

test('confirm false is rejected and leaves the subscription Active', async ({ request }) => {
  await signIn(request);
  const response = await request.post('/api/subscription/cancel', { data: { confirm: false } });
  await expectJson(response, 400, {
    error: 'INVALID_CONFIRMATION',
    message: 'Send JSON with confirm set to true to cancel your subscription.',
  });
  await expectJson(await request.get('/api/subscription'), 200, active);
});

test('confirmed cancellation is stored and repeatable', async ({ request }) => {
  await signIn(request);
  const response = await request.post('/api/subscription/cancel', { data: { confirm: true } });
  await expectJson(response, 200, cancellationSuccess);
  await expectJson(await request.get('/api/subscription'), 200, cancelled);
  const repeated = await request.post('/api/subscription/cancel', { data: { confirm: true } });
  await expectJson(repeated, 200, cancellationSuccess);
});

test('logout clears the client cookie and invalidates the saved session', async ({ request }) => {
  await signIn(request);
  const state = await request.storageState();
  const cookie = state.cookies.find((item) => item.name === 'practice_session');
  if (!cookie) throw new Error('Expected a practice session cookie before logout.');
  const savedSessionId = cookie.value; // Memory only; never log or attach it.

  const logout = await request.post('/api/logout');
  expect(logout.status()).toBe(204);
  expect(await logout.text()).toBe('');
  const afterLogout = await request.storageState();
  expect(afterLogout.cookies.some((item) => item.name === 'practice_session')).toBe(false);

  // Explicit replay proves deletion on the server, not just in the client jar.
  const replay = await request.get('/api/me', {
    headers: { Cookie: `practice_session=${savedSessionId}` },
  });
  await expectJson(replay, 401, unauthenticated);
});
