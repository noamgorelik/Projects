const form = document.querySelector('#sign-in-form');
const button = form.querySelector('button');
const message = document.querySelector('#message');

// Clear feedback even when browser validation prevents submission.
form.addEventListener('input', () => {
  message.textContent = '';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (button.disabled) return;

  message.textContent = '';
  button.disabled = true;
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
    message.textContent = result.message;
  } catch {
    message.textContent = 'Could not reach the sign-in service. Check that the server is running and try again.';
  } finally {
    button.disabled = false;
    button.textContent = 'Sign in';
  }
});
