import { eq } from 'drizzle-orm';
import { runImport } from '../../../scripts/importers/pipeline';
import type { NormalizedFood } from '../../../scripts/importers/normalized';
import { db } from '@/server/db/client';
import { food } from '@/server/db/schema';
import type { DataSourceId } from '@/server/db/schema/foods';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const base = { fiberG: null, sugarG: null, sodiumMg: null, sourceVersion: 'fixture' } as const;

export const FIXTURE_FOODS: Record<string, NormalizedFood> = {
  egg: { ...base, sourceFoodId: 'egg', nameEs: 'Huevo entero, cocido (duro)', aliases: [{ alias: 'huevo', lang: 'es' }, { alias: 'egg', lang: 'en' }], category: 'huevos', preparationState: 'cooked', basis: 'g', kcal: 155, proteinG: 12.6, carbsG: 1.1, fatG: 10.6, fiberG: 0 },
  eggRaw: { ...base, sourceFoodId: 'egg-raw', nameEs: 'Huevo entero, crudo', aliases: [{ alias: 'huevo', lang: 'es' }], category: 'huevos', preparationState: 'raw', basis: 'g', kcal: 143, proteinG: 12.6, carbsG: 0.7, fatG: 9.5 },
  mango: { ...base, sourceFoodId: 'mango', nameEs: 'Mango, crudo', category: 'frutas', preparationState: 'raw', basis: 'g', kcal: 60, proteinG: 0.8, carbsG: 15, fatG: 0.4, fiberG: 1.6 },
  milk: { ...base, sourceFoodId: 'milk', nameEs: 'Leche entera', aliases: [{ alias: 'leche', lang: 'es' }], category: 'lacteos', preparationState: 'prepared', basis: 'ml', kcal: 61, proteinG: 3.2, carbsG: 4.8, fatG: 3.3, densityGPerMl: 1.03 },
  oats: { ...base, sourceFoodId: 'oats', nameEs: 'Avena en hojuelas, seca', category: 'cereales', preparationState: 'raw', basis: 'g', kcal: 379, proteinG: 13.2, carbsG: 67.7, fatG: 6.5, fiberG: 10.1 },
  plantain: { ...base, sourceFoodId: 'plantain', nameEs: 'Plátano maduro, crudo', aliases: [{ alias: 'platano', lang: 'es' }], category: 'tuberculos_platanos', preparationState: 'raw', basis: 'g', kcal: 122, proteinG: 1.3, carbsG: 31.9, fatG: 0.4 },
  riceCooked: { ...base, sourceFoodId: 'rice-cooked', nameEs: 'Arroz blanco, cocido', category: 'cereales', preparationState: 'cooked', basis: 'g', kcal: 130, proteinG: 2.7, carbsG: 28.2, fatG: 0.3 },
  noDensityJuice: { ...base, sourceFoodId: 'juice', nameEs: 'Jugo sin densidad', category: 'bebidas', preparationState: 'prepared', basis: 'g', kcal: 45, proteinG: 0.7, carbsG: 10.4, fatG: 0.2 },
};

export const OFF_AREPA: NormalizedFood = {
  ...base,
  sourceFoodId: '7700000000001',
  nameEs: 'Arepa de maíz blanco',
  brand: 'Marca X',
  category: 'cereales',
  preparationState: 'packaged',
  basis: 'g',
  kcal: 200,
  proteinG: 4,
  carbsG: 40,
  fatG: 2,
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'np-foods-'));

export function importFoods(source: DataSourceId, foods: NormalizedFood[]): void {
  const file = path.join(tmp, `${source}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(file, JSON.stringify(foods));
  runImport(source, { sourceVersion: 'fixture', inputFiles: [file], foods, skipped: [] }, { reportDir: null });
}

/** Imports the fixture catalog; returns food ids by fixture key. */
export function seedFoods(): Record<string, string> {
  importFoods('usda_fdc', Object.values(FIXTURE_FOODS));
  importFoods('off', [OFF_AREPA]);
  const ids: Record<string, string> = {};
  for (const [key, f] of Object.entries(FIXTURE_FOODS)) {
    ids[key] = db().select({ id: food.id }).from(food).where(eq(food.sourceFoodId, f.sourceFoodId)).get()!.id;
  }
  ids.offArepa = db().select({ id: food.id }).from(food).where(eq(food.sourceFoodId, OFF_AREPA.sourceFoodId)).get()!.id;
  return ids;
}
