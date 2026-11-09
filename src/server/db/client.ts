import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema>;
export interface DbHandle {
  sqlite: Database.Database;
  db: Db;
}

export const MIGRATIONS_FOLDER = path.resolve(process.cwd(), 'src/server/db/migrations');

let current: DbHandle | undefined;

export function openDb(filePath: string): DbHandle {
  if (filePath !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  const sqlite = new Database(filePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

export function runMigrations(handle: DbHandle): void {
  migrate(handle.db, { migrationsFolder: MIGRATIONS_FOLDER });
}

/** The shared database for the running process. Opened lazily from DATABASE_PATH. */
export function getDbHandle(): DbHandle {
  if (!current) current = openDb(process.env.DATABASE_PATH || './data/nutripet.db');
  return current;
}

export function db(): Db {
  return getDbHandle().db;
}

/** Replace the shared handle (tests and scripts). */
export function setDbHandle(handle: DbHandle | undefined): void {
  current = handle;
}

/** Run `fn` in a synchronous SQLite transaction. */
export function tx<T>(fn: (d: Db) => T): T {
  const handle = getDbHandle();
  return handle.sqlite.transaction(() => fn(handle.db))();
}
