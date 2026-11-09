/**
 * Row validation. Invalid rows are rejected and reported, never "fixed" (Constitution I).
 * The Atwater check (kcal ≈ 4P + 4C + 9F) only warns: fiber, alcohol and polyols legitimately deviate.
 */
import { FOOD_CATEGORIES } from '../../src/server/db/schema/foods';
import type { NormalizedFood } from './normalized';

export type ValidationResult = { ok: true; warnings: string[] } | { ok: false; errors: string[] };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function validateFood(f: NormalizedFood): ValidationResult {
  const errors: string[] = [];
  if (!f.sourceFoodId) errors.push('missing sourceFoodId');
  if (!f.nameEs?.trim()) errors.push('missing nameEs');
  if (!f.sourceVersion) errors.push('missing sourceVersion');
  if (!FOOD_CATEGORIES.includes(f.category)) errors.push(`invalid category ${f.category}`);
  if (!['raw', 'cooked', 'prepared', 'packaged'].includes(f.preparationState)) errors.push('invalid preparationState');
  if (f.basis !== 'g' && f.basis !== 'ml') errors.push('invalid basis');

  for (const key of ['kcal', 'proteinG', 'carbsG', 'fatG'] as const) {
    if (!isNum(f[key])) errors.push(`missing core nutrient ${key}`);
    else if (f[key] < 0) errors.push(`negative ${key}`);
  }
  for (const key of ['fiberG', 'sugarG', 'sodiumMg'] as const) {
    const v = f[key];
    if (v !== null && (!isNum(v) || v < 0)) errors.push(`invalid ${key}`);
  }
  if (f.densityGPerMl != null && (!isNum(f.densityGPerMl) || f.densityGPerMl < 0.3 || f.densityGPerMl > 2)) {
    errors.push('density out of range 0.3–2.0');
  }
  if (errors.length) return { ok: false, errors };

  if (f.kcal > 900) errors.push('kcal > 900 per 100');
  if (f.basis === 'g' && f.proteinG + f.carbsG + f.fatG > 100.5) errors.push('protein + carbs + fat > 100 g per 100 g');
  // Sources often compute carbs by difference but measure sugars analytically, so a small excess is
  // a known artifact (e.g. USDA milk: carbs 4.8 g, sugars 5.05 g). Reject only clear inconsistencies.
  const sugarTolerance = Math.max(0.5, 0.1 * f.carbsG);
  if (f.sugarG !== null && f.sugarG > f.carbsG + sugarTolerance) errors.push('sugar > carbs');
  if (f.sodiumMg !== null && f.sodiumMg > 40000) errors.push('sodium > 40000 mg');
  if (errors.length) return { ok: false, errors };

  const warnings: string[] = [];
  if (f.sugarG !== null && f.sugarG > f.carbsG) {
    warnings.push(`sugar ${f.sugarG.toFixed(2)} g slightly above carbs ${f.carbsG.toFixed(2)} g (source measurement artifact)`);
  }
  const atwater = 4 * f.proteinG + 4 * f.carbsG + 9 * f.fatG;
  if (Math.abs(f.kcal - atwater) > Math.max(0.15 * f.kcal, 20)) {
    warnings.push(`atwater deviation: kcal ${f.kcal.toFixed(1)} vs 4P+4C+9F ${atwater.toFixed(1)}`);
  }
  return { ok: true, warnings };
}
