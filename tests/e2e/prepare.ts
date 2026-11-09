/** Fresh database for the E2E run: migrations, seeds and a small fixture catalog (no real user data). */
import fs from 'node:fs';
import path from 'node:path';
import { prepareDatabase } from '../../src/server/db/setup';
import { setDbHandle } from '../../src/server/db/client';
import { runImport } from '../../scripts/importers/pipeline';
import type { NormalizedFood } from '../../scripts/importers/normalized';

const file = process.env.DATABASE_PATH || './data/e2e.db';
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${file}${suffix}`, { force: true });
const { handle } = prepareDatabase(file);
setDbHandle(handle);

const base = { fiberG: null, sugarG: null, sodiumMg: null, sourceVersion: 'e2e fixture' } as const;
const foods: NormalizedFood[] = [
  { ...base, sourceFoodId: 'e2e-egg-cooked', nameEs: 'Huevo entero, cocido (duro)', aliases: [{ alias: 'huevo', lang: 'es' }], category: 'huevos', preparationState: 'cooked', basis: 'g', kcal: 155, proteinG: 12.6, carbsG: 1.1, fatG: 10.6 },
  { ...base, sourceFoodId: 'e2e-egg-raw', nameEs: 'Huevo entero, crudo', aliases: [{ alias: 'huevo', lang: 'es' }], category: 'huevos', preparationState: 'raw', basis: 'g', kcal: 143, proteinG: 12.6, carbsG: 0.7, fatG: 9.5 },
  { ...base, sourceFoodId: 'e2e-rice', nameEs: 'Arroz blanco, cocido', aliases: [{ alias: 'arroz', lang: 'es' }], category: 'cereales', preparationState: 'cooked', basis: 'g', kcal: 130, proteinG: 2.7, carbsG: 28.2, fatG: 0.3 },
  { ...base, sourceFoodId: 'e2e-mango', nameEs: 'Mango, crudo', category: 'frutas', preparationState: 'raw', basis: 'g', kcal: 60, proteinG: 0.8, carbsG: 15, fatG: 0.4 },
  { ...base, sourceFoodId: 'e2e-oats', nameEs: 'Avena en hojuelas, seca', category: 'cereales', preparationState: 'raw', basis: 'g', kcal: 379, proteinG: 13.2, carbsG: 67.7, fatG: 6.5 },
];
const input = path.resolve('data/e2e-foods.json');
fs.writeFileSync(input, JSON.stringify(foods));
runImport('usda_fdc', { sourceVersion: 'e2e', inputFiles: [input], foods, skipped: [] }, { reportDir: null });
fs.rmSync(input);
handle.sqlite.close();
console.log(`E2E database ready: ${file}`);
