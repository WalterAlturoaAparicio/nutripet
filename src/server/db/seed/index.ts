import type { Db } from '../client';

/** Idempotent seeders, run after migrations. Each must be safe to run repeatedly. */
export type Seeder = { name: string; run: (db: Db) => void };

const seeders: Seeder[] = [];

export function registerSeeder(seeder: Seeder): void {
  if (!seeders.some((s) => s.name === seeder.name)) seeders.push(seeder);
}

export function runSeeds(db: Db): string[] {
  for (const s of seeders) s.run(db);
  return seeders.map((s) => s.name);
}
