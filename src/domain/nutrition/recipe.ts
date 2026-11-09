/**
 * Ingredient-based preparations (FR-038, FR-039, FR-045).
 *
 * A preparation's nutrients are the sum of its ingredients' contributions, each computed with
 * `scaleNutrients` from the ingredient's own reference (per 100 g or 100 ml of that ingredient).
 * Adding water changes concentration only: it never adds or removes energy from the total.
 * Values per 100 of the final preparation are only available from a yield the user entered;
 * the yield is never inferred by adding ingredient masses/volumes.
 */
import type { Basis, Nutrients, NutrientsPer100, OptionalNutrient, QuantityUnit } from '../types';
import { scaleNutrients, sumNutrients } from './scale';

export type NutritionErrorCode =
  | 'invalid_reference'
  | 'invalid_quantity'
  | 'no_ingredients'
  | 'invalid_yield'
  | 'invalid_servings'
  | 'servings_unknown'
  | 'yield_unknown'
  | 'unit_mismatch'
  | 'portion_exceeds_total'
  | 'not_homogeneous';

/** A calculation input that cannot produce a trustworthy number. Never silently replaced by zero. */
export class NutritionError extends Error {
  constructor(
    readonly code: NutritionErrorCode,
    readonly index?: number,
  ) {
    super(code);
    this.name = 'NutritionError';
  }
}

/** One ingredient: the quantity used and the nutritional reference of that ingredient. */
export interface IngredientInput {
  quantity: number;
  unit: QuantityUnit;
  basis: Basis;
  densityGPerMl: number | null;
  per100: NutrientsPer100;
}

export interface IngredientResult {
  nutrients: Nutrients;
  approximate: boolean;
}

export interface PreparationYield {
  quantity: number;
  unit: QuantityUnit;
}

export interface PreparationInput {
  ingredients: IngredientInput[];
  /** Number of equal portions the preparation is divided into, when known. */
  servings?: number | null;
  /** Actual final mass or volume, entered by the user, when known. */
  yield?: PreparationYield | null;
}

export interface PreparationResult {
  ingredients: IngredientResult[];
  /** Nutrients of the complete preparation (all ingredients). */
  totals: Nutrients;
  incomplete: OptionalNutrient[];
  /** True when any ingredient needed a g↔ml conversion without a known density. */
  approximate: boolean;
  /** Nutrients of one serving, or null when the number of servings is unknown. */
  perServing: Nutrients | null;
  /** Nutrients per 100 g/ml of the final preparation, or null when the yield is unknown. */
  per100OfYield: (Nutrients & { unit: QuantityUnit }) | null;
}

const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const nonNegative = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/** A reference is usable when every core value is a finite, non-negative number (optional ones may be null). */
export function isValidReference(per100: NutrientsPer100 | null | undefined): per100 is NutrientsPer100 {
  if (!per100) return false;
  const core = [per100.kcal, per100.proteinG, per100.carbsG, per100.fatG];
  const optional = [per100.fiberG, per100.sugarG, per100.sodiumMg];
  return core.every(nonNegative) && optional.every((v) => v === null || nonNegative(v));
}

/** Contribution = (quantity in the ingredient's basis / 100) × its value per 100 (FR-032, FR-039). */
export function ingredientContribution(ing: IngredientInput, index?: number): IngredientResult {
  if (!isValidReference(ing.per100)) throw new NutritionError('invalid_reference', index);
  if (!positive(ing.quantity)) throw new NutritionError('invalid_quantity', index);
  return scaleNutrients(ing.per100, ing.quantity, ing.unit, ing.basis, ing.densityGPerMl);
}

export const scaleBy = (n: Nutrients, factor: number): Nutrients => ({
  kcal: n.kcal * factor,
  proteinG: n.proteinG * factor,
  carbsG: n.carbsG * factor,
  fatG: n.fatG * factor,
  fiberG: n.fiberG === null ? null : n.fiberG * factor,
  sugarG: n.sugarG === null ? null : n.sugarG * factor,
  sodiumMg: n.sodiumMg === null ? null : n.sodiumMg * factor,
});

/** Totals of a preparation, per serving (if servings known) and per 100 of the final yield (if known). */
export function computePreparation(input: PreparationInput): PreparationResult {
  if (input.ingredients.length === 0) throw new NutritionError('no_ingredients');
  if (input.servings != null && !positive(input.servings)) throw new NutritionError('invalid_servings');
  if (input.yield != null && !positive(input.yield.quantity)) throw new NutritionError('invalid_yield');
  const ingredients = input.ingredients.map((ing, i) => ingredientContribution(ing, i));
  const { totals, incomplete } = sumNutrients(ingredients.map((r) => r.nutrients));
  return {
    ingredients,
    totals,
    incomplete,
    approximate: ingredients.some((r) => r.approximate),
    perServing: input.servings ? scaleBy(totals, 1 / input.servings) : null,
    per100OfYield: input.yield ? { ...scaleBy(totals, 100 / input.yield.quantity), unit: input.yield.unit } : null,
  };
}

/** How much of a saved preparation was consumed. */
export type Portion =
  | { mode: 'whole' }
  | { mode: 'servings'; servings: number }
  | { mode: 'amount'; quantity: number; unit: QuantityUnit };

export interface PreparationFacts {
  totals: Nutrients;
  servings: number | null;
  yield: PreparationYield | null;
  /** Ingredients evenly distributed (e.g. a beverage). Proportional-by-amount needs this. */
  homogeneous: boolean;
}

/**
 * Fraction of the complete preparation represented by a portion (FR-045):
 * whole → 1; servings → n / total servings; amount → consumed / actual final yield.
 * A portion can never exceed the complete preparation.
 */
export function portionFactor(prep: PreparationFacts, portion: Portion): number {
  let factor: number;
  if (portion.mode === 'whole') factor = 1;
  else if (portion.mode === 'servings') {
    if (!positive(portion.servings)) throw new NutritionError('invalid_quantity');
    if (!prep.servings) throw new NutritionError('servings_unknown');
    factor = portion.servings / prep.servings;
  } else {
    if (!positive(portion.quantity)) throw new NutritionError('invalid_quantity');
    if (!prep.homogeneous) throw new NutritionError('not_homogeneous');
    if (!prep.yield) throw new NutritionError('yield_unknown');
    if (prep.yield.unit !== portion.unit) throw new NutritionError('unit_mismatch');
    factor = portion.quantity / prep.yield.quantity;
  }
  if (factor > 1 + 1e-9) throw new NutritionError('portion_exceeds_total');
  return factor;
}

/** Nutrients of the consumed portion = complete preparation × portion factor. */
export function portionNutrients(prep: PreparationFacts, portion: Portion): { nutrients: Nutrients; factor: number } {
  const factor = portionFactor(prep, portion);
  return { nutrients: scaleBy(prep.totals, factor), factor };
}
