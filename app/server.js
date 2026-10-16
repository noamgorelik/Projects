import express from 'express';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const publicDirectory = fileURLToPath(new URL('./public/', import.meta.url));
const port = Number(process.env.PORT ?? 3000);
const sessions = new Map();
const sessionLifetime = 60 * 60 * 1000;
const cookieOptions = { httpOnly: true, sameSite: 'lax', path: '/' };

function sessionId(request) {
  const cookie = (request.headers.cookie ?? '').split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('practice_session='));
  return cookie?.slice('practice_session='.length);
}

function removeExpiredSessions() {
  for (const [id, session] of sessions) {
    if (session.expiresAt <= Date.now()) sessions.delete(id);
  }
}

// Expired sessions are also removed when accessed; the timer avoids unused buildup.
setInterval(removeExpiredSessions, 60 * 1000).unref();

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

// Apply before JSON parsing so even malformed authentication requests are not cached.
app.use('/api', (request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.resolve(publicDirectory)));

app.get('/health', (request, response) => {
  response.json({ status: 'ok' });
});

app.post('/api/login', (request, response) => {
  const { email, password } = request.body ?? {};

  if (
    typeof email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof password !== 'string' ||
    password.trim().length === 0
  ) {
    return response.status(400).json({
      error: 'INVALID_INPUT',
      message: 'Provide a valid email address and a non-empty password.',
    });
  }

  if (email !== 'demo@example.test' || password !== 'Practice123!') {
    return response.status(401).json({
      error: 'INVALID_CREDENTIALS',
      message: 'Email or password is incorrect.',
    });
  }

  // Replace any existing session with a fresh, unpredictable identifier.
  sessions.delete(sessionId(request));
  const id = randomBytes(32).toString('hex');
  sessions.set(id, {
    user: { email: 'demo@example.test' },
    expiresAt: Date.now() + sessionLifetime,
  });
  response.cookie('practice_session', id, { ...cookieOptions, maxAge: sessionLifetime });
  response.json({
    message: 'Sign-in successful.',
    user: { email: 'demo@example.test' },
  });
});

app.get('/api/me', (request, response) => {
  const id = sessionId(request);
  const session = sessions.get(id);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(id);
    return response.status(401).json({
      error: 'UNAUTHENTICATED',
      message: 'Please sign in.',
    });
  }
  response.json({ user: session.user });
});

app.post('/api/logout', (request, response) => {
  sessions.delete(sessionId(request));
  response.clearCookie('practice_session', cookieOptions);
  response.status(204).end();
});

// Convert JSON parsing failures into readable API responses.
app.use((error, request, response, next) => {
  if (error.type === 'entity.parse.failed') {
    return response.status(400).json({
      error: 'INVALID_JSON',
      message: 'Send a valid JSON request body.',
    });
  }
  if (error.status >= 400 && error.status < 500) {
    return response.status(400).json({
      error: 'INVALID_INPUT',
      message: 'The request body could not be accepted.',
    });
  }
  // Do not log request details, which may include session cookies.
  console.error('Unexpected server error.');
  response.status(500).json({
    error: 'SERVER_ERROR',
    message: 'Something went wrong. Please try again.',
  });
});

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Practice portal: http://127.0.0.1:${port}`);
});
server.on('error', (error) => {
  console.error(`Could not start the server: ${error.message}`);
  process.exitCode = 1;
});
