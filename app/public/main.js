const form = document.querySelector('#sign-in-form');
const fields = document.querySelector('#sign-in-fields');
const button = form.querySelector('button');
const message = document.querySelector('#message');
const account = document.querySelector('#account');
const accountEmail = document.querySelector('#account-email');
const signOut = document.querySelector('#sign-out');
const subscriptionPlan = document.querySelector('#subscription-plan');
const subscriptionStatus = document.querySelector('#subscription-status');
const subscriptionMessage = document.querySelector('#subscription-message');
const retrySubscription = document.querySelector('#retry-subscription');
const cancelSubscription = document.querySelector('#cancel-subscription');
const confirmation = document.querySelector('#cancel-confirmation');
const keepSubscription = document.querySelector('#keep-subscription');
const confirmCancellation = document.querySelector('#confirm-cancellation');
let sessionReady = false;
let subscriptionVersion = 0;
let subscriptionBusy = false;

function setSubscriptionBusy(busy) {
  subscriptionBusy = busy;
  for (const control of [retrySubscription, cancelSubscription, keepSubscription, confirmCancellation]) {
    control.disabled = busy;
  }
}

async function requestSubscription(cancel = false) {
  if (subscriptionBusy || account.hidden || signOut.disabled) return;
  const version = ++subscriptionVersion;
  setSubscriptionBusy(true);
  retrySubscription.hidden = true;
  subscriptionMessage.textContent = cancel ? 'Cancelling subscription…' : 'Loading subscription…';

  try {
    const response = await fetch(cancel ? '/api/subscription/cancel' : '/api/subscription', {
      cache: 'no-store',
      ...(cancel ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      } : {}),
    });
    // Ignore responses from an account view that has been signed out or replaced.
    if (version !== subscriptionVersion) return;
    if (response.status === 401) {
      showUser(null);
      message.textContent = 'Please sign in.';
      return;
    }
    const result = await response.json();
    if (version !== subscriptionVersion) return;
    if (!response.ok) throw new Error(result.message || 'Subscription request failed.');

    subscriptionPlan.textContent = result.subscription.plan;
    subscriptionStatus.textContent = result.subscription.status === 'cancelled' ? 'Cancelled' : 'Active';
    cancelSubscription.hidden = result.subscription.status !== 'active';
    confirmation.hidden = true;
    subscriptionMessage.textContent = cancel ? result.message : '';
  } catch {
    if (version !== subscriptionVersion) return;
    subscriptionMessage.textContent = cancel
      ? 'Could not confirm cancellation. Retry loading to check the current status, or try confirming again.'
      : 'Could not load your subscription. Check that the server is running and retry.';
    retrySubscription.hidden = false;
  } finally {
    if (version === subscriptionVersion) setSubscriptionBusy(false);
  }
}

cancelSubscription.addEventListener('click', () => {
  if (subscriptionBusy || signOut.disabled) return;
  confirmation.hidden = false;
  document.querySelector('#confirmation-heading').focus();
});

keepSubscription.addEventListener('click', () => {
  if (subscriptionBusy) return;
  confirmation.hidden = true;
  cancelSubscription.focus();
});

confirmCancellation.addEventListener('click', () => requestSubscription(true));
retrySubscription.addEventListener('click', () => requestSubscription());

function showUser(user) {
  subscriptionVersion += 1;
  setSubscriptionBusy(false);
  subscriptionPlan.textContent = '—';
  subscriptionStatus.textContent = '—';
  subscriptionMessage.textContent = '';
  cancelSubscription.hidden = true;
  retrySubscription.hidden = true;
  confirmation.hidden = true;
  account.hidden = !user;
  form.hidden = Boolean(user);
  accountEmail.textContent = user ? user.email : '';
  fields.disabled = Boolean(user);
  form.reset();
  if (user) requestSubscription();
}

async function restoreSession() {
  try {
    const response = await fetch('/api/me', { cache: 'no-store' });
    if (response.ok) {
      const result = await response.json();
      showUser(result.user);
      message.textContent = '';
    } else if (response.status === 401) {
      showUser(null);
      message.textContent = '';
    } else {
      throw new Error('Session check failed');
    }
  } catch {
    showUser(null);
    message.textContent = 'Could not check your session. Check that the server is running and try signing in.';
  } finally {
    sessionReady = true;
  }
}

// Clear feedback even when browser validation prevents submission.
form.addEventListener('input', () => {
  message.textContent = '';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!sessionReady || fields.disabled) return;

  message.textContent = '';
  fields.disabled = true;
  button.textContent = 'Signing in…';

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.elements.email.value,
        password: form.elements.password.value,
      }),
    });
    const result = await response.json();
    if (response.ok) showUser(result.user);
    message.textContent = result.message;
  } catch {
    message.textContent = 'Could not reach the sign-in service. Check that the server is running and try again.';
  } finally {
    fields.disabled = !account.hidden;
    button.textContent = 'Sign in';
  }
});

signOut.addEventListener('click', async () => {
  if (signOut.disabled) return;
  // Invalidate pending subscription responses as soon as sign-out starts.
  subscriptionVersion += 1;
  setSubscriptionBusy(true);
  signOut.disabled = true;
  message.textContent = '';
  try {
    const response = await fetch('/api/logout', { method: 'POST' });
    if (response.status !== 204) throw new Error('Sign-out failed');
    showUser(null);
    message.textContent = 'Signed out.';
  } catch {
    message.textContent = 'Could not confirm sign-out. Please try again.';
  } finally {
    signOut.disabled = false;
    if (!account.hidden) {
      setSubscriptionBusy(false);
      requestSubscription();
    }
  }
});

restoreSession();
