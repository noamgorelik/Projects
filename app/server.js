import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const publicDirectory = fileURLToPath(new URL('./public/', import.meta.url));
const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.resolve(publicDirectory)));

app.get('/health', (request, response) => {
  response.json({ status: 'ok' });
});

// Practice credential validation only: this does not create a session.
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

  response.json({
    message: 'Sign-in successful.',
    user: { email: 'demo@example.test' },
  });
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
  console.error(error);
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
