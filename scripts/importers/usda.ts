/**
 * USDA FoodData Central adapters (T051): `usda_fdc` (Foundation + SR Legacy) and `usda_fndds` (Survey/FNDDS).
 * Reads the pinned bulk JSON files fetched by `pnpm fetch:usda` and keeps only allowlisted foods.
 * Values are per 100 g in FDC; liquids are converted to per 100 ml only when the allowlist gives a density.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { FoodCategory } from '../../src/server/db/schema/foods';
import { numOrNull, parseCsv, splitAliases } from './csv';
import type { AdapterResult, NormalizedFood } from './normalized';

interface FdcNutrient {
  nutrient?: { id: number; unitName?: string };
  amount?: number;
}
interface FdcFood {
  fdcId: number;
  description: string;
  foodNutrients?: FdcNutrient[];
  publicationDate?: string;
}

const DATASETS = {
  usda_fdc: [
    { file: 'foundation.json', key: 'FoundationFoods', version: 'FDC Foundation 2026-10-29' },
    { file: 'sr_legacy.json', key: 'SRLegacyFoods', version: 'SR Legacy 2018-04' },
  ],
  usda_fndds: [{ file: 'fndds.json', key: 'SurveyFoods', version: 'FNDDS 2024-10-31' }],
} as const;

const ALLOWLIST = { usda_fdc: 'allowlist.csv', usda_fndds: 'allowlist-fndds.csv' } as const;

/** First nutrient id present (with the expected unit) wins. */
function pick(food: FdcFood, ids: number[], unit: string): number | null {
  for (const id of ids) {
    const n = food.foodNutrients?.find((x) => x.nutrient?.id === id && typeof x.amount === 'number');
    if (n && (!n.nutrient?.unitName || n.nutrient.unitName.toLowerCase() === unit)) return n.amount!;
  }
  return null;
}

export function normalizeFdcFood(
  f: FdcFood,
  row: Record<string, string>,
  sourceVersion: string,
): { food?: NormalizedFood; reason?: string } {
  const kcal = pick(f, [1008, 2047, 2048], 'kcal');
  const protein = pick(f, [1003], 'g');
  const carbs = pick(f, [1005], 'g');
  const fat = pick(f, [1004], 'g');
  if (kcal === null || protein === null || carbs === null || fat === null) {
    return { reason: 'missing core nutrient in source' };
  }
  const basis = row.basis === 'ml' ? 'ml' : 'g';
  const density = numOrNull(row.density_g_per_ml);
  if (basis === 'ml' && !density) return { reason: 'basis ml requires density_g_per_ml in the allowlist' };
  // FDC values are per 100 g. Per 100 ml = per 100 g × density (g per ml).
  const factor = basis === 'ml' ? density! : 1;
  const scale = (v: number | null) => (v === null ? null : v * factor);
  return {
    food: {
      sourceFoodId: String(f.fdcId),
      nameEs: row.name_es!,
      nameEn: f.description,
      aliases: [...splitAliases(row.aliases_es, 'es'), { alias: f.description, lang: 'en' }],
      category: row.category as FoodCategory,
      preparationState: row.preparation_state as NormalizedFood['preparationState'],
      brand: null,
      basis,
      kcal: kcal * factor,
      proteinG: protein * factor,
      carbsG: carbs * factor,
      fatG: fat * factor,
      fiberG: scale(pick(f, [1079], 'g')),
      sugarG: scale(pick(f, [2000, 1063], 'g')),
      sodiumMg: scale(pick(f, [1093], 'mg')),
      densityGPerMl: density,
      sourceVersion,
    },
  };
}

export function loadUsda(sourceId: 'usda_fdc' | 'usda_fndds', dir = path.resolve('data/sources/usda')): AdapterResult {
  const allowlistPath = path.join(dir, ALLOWLIST[sourceId]);
  const rows = parseCsv(fs.readFileSync(allowlistPath, 'utf8'));
  const byId = new Map<number, { food: FdcFood; version: string }>();
  const inputFiles = [allowlistPath];
  for (const ds of DATASETS[sourceId]) {
    const file = path.join(dir, ds.file);
    if (!fs.existsSync(file)) throw new Error(`Falta ${file}. Ejecuta primero: pnpm fetch:usda`);
    inputFiles.push(file);
    const foods = (JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, FdcFood[]>)[ds.key] ?? [];
    for (const f of foods) byId.set(f.fdcId, { food: f, version: ds.version });
  }
  const result: AdapterResult = {
    sourceVersion: DATASETS[sourceId].map((d) => d.version).join(' + '),
    inputFiles,
    foods: [],
    skipped: [],
  };
  for (const row of rows) {
    const id = Number(row.fdc_id);
    const entry = byId.get(id);
    if (!entry) {
      result.skipped.push({ sourceFoodId: row.fdc_id ?? '', name: row.name_es ?? '', reason: 'fdc_id not found in dataset' });
      continue;
    }
    const n = normalizeFdcFood(entry.food, row, entry.version);
    if (n.food) result.foods.push(n.food);
    else result.skipped.push({ sourceFoodId: row.fdc_id!, name: row.name_es ?? '', reason: n.reason! });
  }
  return result;
}
