import { openDb, runMigrations, type DbHandle } from './client';
import { runSeeds } from './seed';
import './seed/all';

/** Open a database file, apply all migrations and run every seeder. */
export function prepareDatabase(filePath: string): { handle: DbHandle; seeds: string[] } {
  const handle = openDb(filePath);
  runMigrations(handle);
  const seeds = runSeeds(handle.db);
  return { handle, seeds };
}
