import { mkdirSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { acquireLabLock, dataDirectory, openLabDatabase } from './database.js';

let database;
let releaseLock;
try {
  const { values } = parseArgs({ options: { case: { type: 'string' } } });
  if (values.case !== '1') throw new Error('Use --case=1. Only Case 1 is implemented.');
  const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  const fixture = readFileSync(new URL('./fixtures/case-1.sql', import.meta.url), 'utf8');
  mkdirSync(dataDirectory, { recursive: true });
  releaseLock = acquireLabLock();
  database = openLabDatabase({ allowCreate: true });
  // Reset only the fixed lab file; rollback preserves old data if seeding fails.
  database.exec('BEGIN IMMEDIATE;');
  try {
    database.exec('DROP TABLE IF EXISTS subscriptions; DROP TABLE IF EXISTS accounts;');
    database.exec(schema);
    database.exec(fixture);
    database.exec('COMMIT;');
  } catch (error) {
    database.exec('ROLLBACK;');
    throw error;
  }
  console.log('Case 1 fictional lab data reset. No portal data or sessions were changed.');
} catch (error) {
  console.error(`Lab reset failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  database?.close();
  releaseLock?.();
}
