const form = document.querySelector('#sign-in-form');
const fields = document.querySelector('#sign-in-fields');
const button = form.querySelector('button');
const message = document.querySelector('#message');
const account = document.querySelector('#account');
const accountEmail = document.querySelector('#account-email');
const signOut = document.querySelector('#sign-out');
let sessionReady = false;

function showUser(user) {
  account.hidden = !user;
  form.hidden = Boolean(user);
  accountEmail.textContent = user ? user.email : '';
  fields.disabled = Boolean(user);
  form.reset();
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
  }
});

restoreSession();
