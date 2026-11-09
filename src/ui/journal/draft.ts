/**
 * The meal being built on the client (FR-035a). Rows only hold the inputs the server also uses;
 * every number shown is computed by `src/domain/nutrition` (the same functions the server runs),
 * so the UI has no calculation logic of its own.
 */
import { portionNutrients, scaleNutrients, sumNutrients, type PreparationFacts } from '@/domain/nutrition';
import type { Nutrients } from '@/domain/types';
import type { EntryView, FoodSummary, PortionInput, RecipeView } from '@/ui/types';
import { formatQuantity } from '@/ui/format/units';

export interface FoodRef {
  basis: 'g' | 'ml';
  densityGPerMl: number | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

interface Base {
  key: string;
  /** Set when the row is an existing entry of the meal being edited. */
  entryId?: string;
  name: string;
}

export type DraftItem =
  | (Base & {
      kind: 'food';
      foodId: string;
      preparationState: FoodSummary['preparationState'];
      productForm: 'as_sold' | 'dry_mix' | 'concentrate';
      source: string;
      quantity: number;
      unit: 'g' | 'ml';
      ref: FoodRef;
    })
  | (Base & { kind: 'recipe'; recipeId: string; recipeVersionId: string; portion: PortionInput; facts: PreparationFacts; yieldUnit: 'g' | 'ml' | null });

let seq = 0;
export const newKey = () => `d${Date.now().toString(36)}${(seq++).toString(36)}`;

export const refFromSummary = (f: FoodSummary): FoodRef => ({
  basis: f.basis,
  densityGPerMl: f.densityGPerMl,
  kcal: f.kcalPer100,
  proteinG: f.proteinPer100,
  carbsG: f.carbsPer100,
  fatG: f.fatPer100,
});

/** A food summary for QuantitySheet built from a row's reference (keeps the snapshot values). */
export function summaryFromRow(row: Extract<DraftItem, { kind: 'food' }>): FoodSummary {
  return {
    id: row.foodId,
    nameEs: row.name,
    nameEn: null,
    category: '',
    preparationState: row.preparationState,
    productForm: row.productForm,
    brand: null,
    basis: row.ref.basis,
    densityGPerMl: row.ref.densityGPerMl,
    source: row.source,
    kcalPer100: row.ref.kcal,
    proteinPer100: row.ref.proteinG,
    carbsPer100: row.ref.carbsG,
    fatPer100: row.ref.fatG,
    isFavorite: false,
    isCustom: false,
    hasOverride: false,
  };
}

export function foodRow(f: FoodSummary, quantity: number, unit: 'g' | 'ml'): DraftItem {
  return {
    key: newKey(),
    kind: 'food',
    foodId: f.id,
    name: f.nameEs,
    preparationState: f.preparationState,
    productForm: f.productForm ?? 'as_sold',
    source: f.source,
    quantity,
    unit,
    ref: refFromSummary(f),
  };
}

export function recipeFacts(r: RecipeView): PreparationFacts {
  return { totals: r.totals, servings: r.servings, yield: r.yield, homogeneous: r.homogeneous };
}

export function recipeRow(r: RecipeView, portion: PortionInput, entryId?: string): DraftItem {
  return { key: newKey(), entryId, kind: 'recipe', recipeId: r.id, recipeVersionId: r.versionId, name: r.name, portion, facts: recipeFacts(r), yieldUnit: r.yield?.unit ?? null };
}

/** Existing food entry → row whose reference is the entry's own snapshot (same as the server recompute). */
export function rowFromEntry(e: EntryView): DraftItem | null {
  if (e.kind !== 'food' || !e.per100 || e.quantity === null || e.unit === null || !e.foodId) return null;
  return {
    key: newKey(),
    entryId: e.id,
    kind: 'food',
    foodId: e.foodId,
    name: e.name,
    preparationState: e.preparationState,
    productForm: e.productForm,
    source: e.source,
    quantity: e.quantity,
    unit: e.unit,
    ref: { ...e.per100 },
  };
}

export const entryPortion = (e: EntryView): PortionInput => {
  const p = e.recipe!.portion;
  if (p.mode === 'servings') return { mode: 'servings', servings: p.servings ?? 1 };
  if (p.mode === 'amount' && e.quantity !== null && e.unit !== null) return { mode: 'amount', quantity: e.quantity, unit: e.unit };
  return { mode: 'whole' };
};

const EMPTY: Nutrients = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: null, sugarG: null, sodiumMg: null };

/** Nutrients of one row; an invalid portion yields an `error` code instead of a number. */
export function rowNutrients(row: DraftItem): { nutrients: Nutrients; approximate: boolean; error?: string } {
  if (row.kind === 'food') {
    const { kcal, proteinG, carbsG, fatG } = row.ref;
    return scaleNutrients({ kcal, proteinG, carbsG, fatG, fiberG: null, sugarG: null, sodiumMg: null }, row.quantity, row.unit, row.ref.basis, row.ref.densityGPerMl);
  }
  try {
    return { nutrients: portionNutrients(row.facts, row.portion).nutrients, approximate: false };
  } catch (e) {
    return { nutrients: EMPTY, approximate: false, error: (e as { code?: string }).code ?? 'invalid' };
  }
}

export function draftTotals(rows: DraftItem[]): Nutrients {
  return sumNutrients(rows.map((r) => rowNutrients(r).nutrients)).totals;
}

/** Row → API meal item (new item, or kept entry with its new quantity/portion). */
export function toApiItem(row: DraftItem, forUpdate: boolean): Record<string, unknown> {
  if (forUpdate && row.entryId) {
    return row.kind === 'food' ? { entryId: row.entryId, quantity: row.quantity, unit: row.unit } : { entryId: row.entryId, portion: row.portion };
  }
  return row.kind === 'food' ? { foodId: row.foodId, quantity: row.quantity, unit: row.unit } : { recipeId: row.recipeId, portion: row.portion };
}

/** "150 g" for foods; "Preparación · 1 de 2 porciones" style text for recipe portions. */
export function entryAmountText(e: EntryView, foodUnit: 'metric' | 'imperial' = 'metric', t: (k: string, p?: Record<string, string | number>) => string): string {
  const qty = e.quantity !== null && e.unit !== null ? formatQuantity(e.quantity, e.unit, foodUnit) : null;
  if (e.kind === 'food') return qty ?? '';
  const p = e.recipe!.portion;
  const what = p.mode === 'whole' ? t('recipes.portion.whole') : p.mode === 'servings' ? `${p.servings} ${t('recipes.portion.servings').toLowerCase()}` : null;
  return [t('foods.sources.recipe'), what, qty].filter(Boolean).join(' · ');
}
