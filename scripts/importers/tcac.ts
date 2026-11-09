/**
 * Colombian food composition table adapter (T054). Disabled unless TCAC_ENABLED=true, pending
 * verification of the ICBF reuse license. Rows without a second reviewer (`verified_by`) are rejected.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { FoodCategory } from '../../src/server/db/schema/foods';
import { numOrNull, parseCsv, splitAliases } from './csv';
import type { AdapterResult } from './normalized';

export const TCAC_COLUMNS = [
  'tcac_code', 'name_es', 'aliases_es', 'category', 'preparation_state', 'basis', 'kcal', 'protein_g', 'carbs_g',
  'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg', 'density_g_per_ml', 'edition', 'page', 'transcribed_by', 'verified_by',
] as const;

export function tcacEnabled(): boolean {
  return process.env.TCAC_ENABLED === 'true' || process.env.TCAC_ENABLED === '1';
}

export function loadTcac(input = path.resolve('data/sources/tcac/foods.csv')): AdapterResult {
  const rows = parseCsv(fs.readFileSync(input, 'utf8'));
  const result: AdapterResult = { sourceVersion: 'TCAC', inputFiles: [input], foods: [], skipped: [] };
  const editions = new Set<string>();
  for (const r of rows) {
    if (!r.verified_by) {
      result.skipped.push({ sourceFoodId: r.tcac_code ?? '', name: r.name_es ?? '', reason: 'row not double-checked (verified_by empty)' });
      continue;
    }
    const edition = r.edition || 'unknown';
    editions.add(edition);
    result.foods.push({
      sourceFoodId: r.tcac_code!,
      nameEs: r.name_es!,
      nameEn: null,
      aliases: splitAliases(r.aliases_es),
      category: r.category as FoodCategory,
      preparationState: r.preparation_state as 'raw' | 'cooked' | 'prepared' | 'packaged',
      brand: null,
      basis: r.basis === 'ml' ? 'ml' : 'g',
      kcal: numOrNull(r.kcal) ?? NaN,
      proteinG: numOrNull(r.protein_g) ?? NaN,
      carbsG: numOrNull(r.carbs_g) ?? NaN,
      fatG: numOrNull(r.fat_g) ?? NaN,
      fiberG: numOrNull(r.fiber_g),
      sugarG: numOrNull(r.sugar_g),
      sodiumMg: numOrNull(r.sodium_mg),
      densityGPerMl: numOrNull(r.density_g_per_ml),
      sourceVersion: `TCAC ${edition}${r.page ? ` p.${r.page}` : ''}`,
    });
  }
  result.sourceVersion = `TCAC ${[...editions].join(', ') || 'sin filas'}`;
  return result;
}
