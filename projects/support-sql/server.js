import express from 'express';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { existsSync } from 'node:fs';
import { acquireLabLock, databasePath, openLabDatabase } from './database.js';

let database;
let releaseLock;
let resourcesClosed = false;
function closeDatabase() {
  if (resourcesClosed) return;
  resourcesClosed = true;
  try {
    database?.close();
  } finally {
    releaseLock?.();
  }
}

try {
  const { values } = parseArgs({ options: {
    case: { type: 'string' }, mode: { type: 'string' },
  } });
  if (values.case !== '1' || !['seeded', 'corrected'].includes(values.mode)) {
    throw new Error('Use --case=1 --mode=seeded or --case=1 --mode=corrected.');
  }
  if (!existsSync(databasePath)) {
    throw new Error('Lab database is missing. Run npm run support:reset -- --case=1 first.');
  }
  releaseLock = acquireLabLock();
  database = openLabDatabase();
  // Intentionally seeded defect: exact matching ignores the agreed normalization.
  const sql = values.mode === 'seeded'
    ? 'SELECT id, email FROM accounts WHERE email = ?'
    : 'SELECT id, email FROM accounts WHERE lower(email) = lower(?)';
  const lookup = database.prepare(sql);
  const app = express();

  app.use((request, response, next) => {
    response.locals.requestId = randomUUID();
    response.locals.lookupInput = null;
    response.locals.resultCount = null;
    response.set('X-Request-Id', response.locals.requestId);
    response.set('Cache-Control', 'no-store');
    response.on('finish', () => {
      console.log(JSON.stringify({
        requestId: response.locals.requestId,
        lab: 'support-sql', case: 1, mode: values.mode,
        method: request.method, path: request.path,
        lookupInput: response.locals.lookupInput,
        resultCount: response.locals.resultCount, status: response.statusCode,
      }));
    });
    next();
  });

  app.get('/health', (request, response) => {
    response.json({ status: 'ok', lab: 'support-sql', case: 1, mode: values.mode });
  });

  app.get('/api/accounts/lookup', (request, response) => {
    const email = request.query.email;
    response.locals.lookupInput = typeof email === 'string' ? email : null;
    if (typeof email !== 'string' || email.trim() === '') {
      response.locals.resultCount = 0;
      return response.status(400).json({ error: 'INVALID_INPUT', message: 'Provide a non-empty email.' });
    }
    const parameter = values.mode === 'corrected' ? email.trim() : email;
    const rows = lookup.all(parameter);
    response.locals.resultCount = rows.length;
    if (rows.length === 0) {
      return response.status(404).json({ error: 'ACCOUNT_NOT_FOUND', message: 'Account not found.' });
    }
    response.json({ account: rows[0] });
  });

  app.use((request, response) => {
    response.status(404).json({ error: 'NOT_FOUND', message: 'Lab endpoint not found.' });
  });
  app.use((error, request, response, next) => {
    response.status(500).json({ error: 'LAB_ERROR', message: 'Lab request failed. Inspect the case setup.' });
  });

  const server = app.listen(3300, '127.0.0.1');
  server.on('listening', () => {
    console.log(JSON.stringify({ lab: 'support-sql', case: 1, mode: values.mode, url: 'http://127.0.0.1:3300' }));
  });
  server.on('error', (error) => {
    console.error(error.code === 'EADDRINUSE'
      ? 'Lab port 3300 is occupied. No other process was stopped.'
      : `Lab startup failed: ${error.message}`);
    closeDatabase();
    process.exitCode = 1;
  });
  let stopping = false;
  function shutdown() {
    if (stopping) return;
    stopping = true;
    server.close(() => closeDatabase());
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (error) {
  console.error(`Lab startup failed: ${error.message}`);
  closeDatabase();
  process.exitCode = 1;
}
