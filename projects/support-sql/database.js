import { DatabaseSync } from 'node:sqlite';
import { closeSync, existsSync, openSync, unlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const dataDirectory = fileURLToPath(new URL('./data/', import.meta.url));
export const databasePath = fileURLToPath(new URL('./data/lab.sqlite', import.meta.url));
const lockPath = fileURLToPath(new URL('./data/lab.lock', import.meta.url));

// Server and reset both acquire this lock. Neither removes another process's lock.
export function acquireLabLock() {
  let descriptor;
  try {
    descriptor = openSync(lockPath, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error('Lab is locked. Stop the lab before reset/start. See README for stale-lock recovery.');
    }
    throw error;
  }
  try {
    writeFileSync(descriptor, JSON.stringify({ pid: process.pid }) + '\n');
  } catch (error) {
    closeSync(descriptor);
    unlinkSync(lockPath);
    throw error;
  }
  return () => {
    closeSync(descriptor);
    unlinkSync(lockPath);
  };
}

export function openLabDatabase({ allowCreate = false } = {}) {
  if (!allowCreate && !existsSync(databasePath)) {
    throw new Error('Lab database is missing. Run npm run support:reset -- --case=1 first.');
  }
  const database = new DatabaseSync(databasePath);
  try {
    database.exec('PRAGMA foreign_keys = ON;');
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}
