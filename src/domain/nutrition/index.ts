/**
 * Nutrient scaling (FR-032): amount = (quantity in the food's basis / 100) × value per 100.
 * Unknown optional nutrients stay null (FR-021).
 */
import type { Basis, Nutrients, NutrientsPer100, OptionalNutrient, QuantityUnit } from '../types';

/** Converts the entered quantity to the food's basis. Without a density, 1 g = 1 ml is assumed (approximate). */
export function quantityInBasis(
  quantity: number,
  unit: QuantityUnit,
  basis: Basis,
  densityGPerMl?: number | null,
): { amount: number; approximate: boolean } {
  if (unit === basis) return { amount: quantity, approximate: false };
  if (!densityGPerMl) return { amount: quantity, approximate: true };
  return unit === 'ml' ? { amount: quantity * densityGPerMl, approximate: false } : { amount: quantity / densityGPerMl, approximate: false };
}

export function scaleNutrients(
  per100: NutrientsPer100,
  quantity: number,
  unit: QuantityUnit,
  basis: Basis,
  densityGPerMl?: number | null,
): { nutrients: Nutrients; approximate: boolean } {
  const { amount, approximate } = quantityInBasis(quantity, unit, basis, densityGPerMl);
  const f = amount / 100;
  const opt = (v: number | null) => (v === null ? null : v * f);
  return {
    nutrients: {
      kcal: per100.kcal * f,
      proteinG: per100.proteinG * f,
      carbsG: per100.carbsG * f,
      fatG: per100.fatG * f,
      fiberG: opt(per100.fiberG),
      sugarG: opt(per100.sugarG),
      sodiumMg: opt(per100.sodiumMg),
    },
    approximate,
  };
}

const OPTIONAL: [OptionalNutrient, 'fiberG' | 'sugarG' | 'sodiumMg'][] = [
  ['fiber', 'fiberG'],
  ['sugar', 'sugarG'],
  ['sodium', 'sodiumMg'],
];

/**
 * Sums nutrients. Optional nutrients add only known values; any unknown value marks that nutrient
 * as incomplete. A nutrient unknown in every item sums to null.
 */
export function sumNutrients(list: Nutrients[]): { totals: Nutrients; incomplete: OptionalNutrient[] } {
  const totals: Nutrients = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 };
  const incomplete: OptionalNutrient[] = [];
  for (const n of list) {
    totals.kcal += n.kcal;
    totals.proteinG += n.proteinG;
    totals.carbsG += n.carbsG;
    totals.fatG += n.fatG;
  }
  for (const [name, key] of OPTIONAL) {
    const known = list.map((n) => n[key]).filter((v): v is number => v !== null);
    if (known.length < list.length) incomplete.push(name);
    totals[key] = list.length > 0 && known.length === 0 ? null : known.reduce((s, v) => s + v, 0);
  }
  return { totals, incomplete };
}
