import { mkdirSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { acquireLabLock, dataDirectory, openLabDatabase } from './database.js';

let database;
let releaseLock;
try {
  const { values } = parseArgs({ options: { case: { type: 'string' } } });
  const fixtures = { '1': './fixtures/case-1.sql', '2': './fixtures/case-2.sql' };
  if (!Object.hasOwn(fixtures, values.case)) throw new Error('Use --case=1 or --case=2.');
  const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  const fixture = readFileSync(new URL(fixtures[values.case], import.meta.url), 'utf8');
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
  console.log(`Case ${values.case} fictional lab data reset. No portal data or sessions were changed.`);
} catch (error) {
  console.error(`Lab reset failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  database?.close();
  releaseLock?.();
}
