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
  if (!['1', '2'].includes(values.case) || !['seeded', 'corrected'].includes(values.mode)) {
    throw new Error('Use --case=1 or --case=2, with --mode=seeded or --mode=corrected.');
  }
  const selectedCase = Number(values.case);
  if (!existsSync(databasePath)) {
    throw new Error(`Lab database is missing. Run npm run support:reset -- --case=${selectedCase} first.`);
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
    response.locals.accountId = null;
    response.locals.rowsChanged = null;
    response.set('X-Request-Id', response.locals.requestId);
    response.set('Cache-Control', 'no-store');
    response.on('finish', () => {
      console.log(JSON.stringify({
        requestId: response.locals.requestId,
        lab: 'support-sql', case: selectedCase, mode: values.mode,
        method: request.method, path: request.path,
        lookupInput: response.locals.lookupInput,
        resultCount: response.locals.resultCount, status: response.statusCode,
        accountId: response.locals.accountId, rowsChanged: response.locals.rowsChanged,
      }));
    });
    next();
  });

  app.get('/health', (request, response) => {
    response.json({ status: 'ok', lab: 'support-sql', case: selectedCase, mode: values.mode });
  });

  if (selectedCase === 1) {
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
  }

  if (selectedCase === 2) {
    const findAccount = database.prepare('SELECT id FROM accounts WHERE id = ?');
    const findSubscription = database.prepare(
      'SELECT id, account_id, plan, status FROM subscriptions WHERE account_id = ?'
    );
    // Seeded defect: an account ID is incorrectly matched against subscription ID.
    const cancellationSql = values.mode === 'seeded'
      ? "UPDATE subscriptions SET status = 'cancelled' WHERE id = ?"
      : "UPDATE subscriptions SET status = 'cancelled' WHERE account_id = ?";
    const cancelSubscription = database.prepare(cancellationSql);

    // This header selects fictional fixture data. It is NOT authentication.
    app.use('/api/subscription', (request, response, next) => {
      const header = request.get('X-Lab-Account-Id');
      const accountId = Number(header);
      if (!header || !/^[1-9]\d*$/.test(header) || !Number.isSafeInteger(accountId)) {
        return response.status(400).json({
          error: 'INVALID_ACCOUNT_CONTEXT',
          message: 'Provide X-Lab-Account-Id as a positive integer.',
        });
      }
      response.locals.accountId = accountId;
      if (!findAccount.get(accountId)) {
        return response.status(404).json({ error: 'ACCOUNT_NOT_FOUND', message: 'Account not found.' });
      }
      next();
    });
    app.use('/api/subscription', express.json({ limit: '10kb' }));

    app.get('/api/subscription', (request, response) => {
      const subscription = findSubscription.get(response.locals.accountId);
      response.locals.resultCount = subscription ? 1 : 0;
      if (!subscription) {
        return response.status(404).json({ error: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found.' });
      }
      response.json({ subscription });
    });

    app.post('/api/subscription/cancel', (request, response) => {
      if (!request.is('application/json') || request.body?.confirm !== true) {
        return response.status(400).json({
          error: 'INVALID_CONFIRMATION',
          message: 'Send JSON with confirm set to true to cancel your subscription.',
        });
      }
      const outcome = cancelSubscription.run(response.locals.accountId);
      response.locals.rowsChanged = Number(outcome.changes);
      if (values.mode === 'corrected' && response.locals.rowsChanged !== 1) {
        return response.status(409).json({
          error: 'CANCELLATION_NOT_APPLIED',
          message: 'Expected to update exactly one subscription. Cancellation was not confirmed.',
        });
      }
      // Seeded mode intentionally reports success even when zero rows match.
      response.json({ message: 'Subscription cancelled.' });
    });
  }

  app.use((request, response) => {
    response.status(404).json({ error: 'NOT_FOUND', message: 'Lab endpoint not found.' });
  });
  app.use((error, request, response, next) => {
    if (selectedCase === 2 && error.type === 'entity.parse.failed') {
      return response.status(400).json({ error: 'INVALID_JSON', message: 'Send a valid JSON request body.' });
    }
    response.status(500).json({ error: 'LAB_ERROR', message: 'Lab request failed. Inspect the case setup.' });
  });

  const server = app.listen(3300, '127.0.0.1');
  server.on('listening', () => {
    console.log(JSON.stringify({ lab: 'support-sql', case: selectedCase, mode: values.mode, url: 'http://127.0.0.1:3300' }));
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
