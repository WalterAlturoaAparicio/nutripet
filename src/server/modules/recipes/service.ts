/**
 * Saved preparations (FR-038, FR-039, FR-045–FR-049). Each save creates an immutable recipe_version with its
 * ingredient snapshots and calculated totals; meal entries reference the exact version they used,
 * so editing a recipe or the catalog never changes registered meals (FR-046).
 * All arithmetic is delegated to `src/domain/nutrition`.
 */
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  computePreparation,
  NutritionError,
  scaleBy,
  type IngredientInput,
  type PreparationFacts,
} from '@/domain/nutrition';
import type { Nutrients, NutrientsPer100, OptionalNutrient } from '@/domain/types';
import { db, tx, type Db } from '../../db/client';
import { recipe, recipeIngredient, recipeVersion } from '../../db/schema';
import { newId } from '../../db/ids';
import { nowIso } from '../../clock';
import { ApiError, notFound } from '../../http/errors';
import type { RecipeInput } from '../../validation/recipes';
import { effectiveVersion, visibleFood, type FoodRow, type FoodVersionRow } from '../foods/service';

export type RecipeRow = typeof recipe.$inferSelect;
export type RecipeVersionRow = typeof recipeVersion.$inferSelect;
type IngredientRow = typeof recipeIngredient.$inferSelect;

const NUTRITION_MESSAGES: Record<NutritionError['code'], string> = {
  invalid_reference: 'Este alimento no tiene valores nutricionales válidos; no se puede calcular.',
  invalid_quantity: 'La cantidad debe ser mayor que 0.',
  no_ingredients: 'Agrega al menos un ingrediente.',
  invalid_yield: 'El rendimiento debe ser mayor que 0.',
  invalid_servings: 'Las porciones deben ser mayores que 0.',
  servings_unknown: 'Esta preparación no tiene un número de porciones definido.',
  yield_unknown: 'Para registrar una cantidad, indica cuánto rindió la preparación (g o ml finales).',
  unit_mismatch: 'Usa la misma unidad del rendimiento de la preparación.',
  portion_exceeds_total: 'La porción no puede ser mayor que la preparación completa.',
  not_homogeneous:
    'Esta preparación no es homogénea: registra la preparación completa, por porciones, o los ingredientes que comiste.',
};

/** Domain calculation errors become field-level VALIDATION errors (FR-083). */
export function asApiError(err: unknown, field = 'portion'): never {
  if (err instanceof NutritionError) {
    const key = err.index === undefined ? field : `ingredients.${err.index}`;
    throw new ApiError('VALIDATION', NUTRITION_MESSAGES[err.code], { fields: { [key]: NUTRITION_MESSAGES[err.code] }, reason: err.code });
  }
  throw err;
}

export const per100OfVersion = (v: FoodVersionRow): NutrientsPer100 => ({
  kcal: v.kcal,
  proteinG: v.proteinG,
  carbsG: v.carbsG,
  fatG: v.fatG,
  fiberG: v.fiberG,
  sugarG: v.sugarG,
  sodiumMg: v.sodiumMg,
});

const ingredientInputFromRow = (r: IngredientRow): IngredientInput => ({
  quantity: r.quantity,
  unit: r.unit,
  basis: r.snapBasis,
  densityGPerMl: r.snapDensityGPerMl,
  per100: {
    kcal: r.snapKcalPer100,
    proteinG: r.snapProteinPer100,
    carbsG: r.snapCarbsPer100,
    fatG: r.snapFatPer100,
    fiberG: r.snapFiberPer100,
    sugarG: r.snapSugarPer100,
    sodiumMg: r.snapSodiumPer100,
  },
});

const versionTotals = (v: RecipeVersionRow): Nutrients => ({
  kcal: v.kcal,
  proteinG: v.proteinG,
  carbsG: v.carbsG,
  fatG: v.fatG,
  fiberG: v.fiberG,
  sugarG: v.sugarG,
  sodiumMg: v.sodiumMg,
});

/** The facts a portion is calculated from: always the recipe version's own stored totals. */
export function versionFacts(v: RecipeVersionRow): PreparationFacts {
  return {
    totals: versionTotals(v),
    servings: v.servings,
    yield: v.yieldQuantity !== null && v.yieldUnit !== null ? { quantity: v.yieldQuantity, unit: v.yieldUnit } : null,
    homogeneous: v.homogeneous,
  };
}

function ownRecipe(profileId: string, recipeId: string, opts: { includeHidden?: boolean } = {}): RecipeRow {
  const r = db()
    .select()
    .from(recipe)
    .where(and(eq(recipe.id, recipeId), eq(recipe.profileId, profileId), opts.includeHidden ? undefined : isNull(recipe.hiddenAt)))
    .get();
  if (!r) throw notFound('Preparación no encontrada.');
  return r;
}

/** A version of the profile's recipe (the current one by default). Hidden recipes stay readable for history. */
export function recipeVersionFor(profileId: string, recipeId: string, versionId?: string): { recipe: RecipeRow; version: RecipeVersionRow } {
  const r = ownRecipe(profileId, recipeId, { includeHidden: versionId !== undefined });
  const v = db()
    .select()
    .from(recipeVersion)
    .where(and(eq(recipeVersion.recipeId, r.id), eq(recipeVersion.id, versionId ?? r.currentVersionId ?? '')))
    .get();
  if (!v) throw notFound('Versión de la preparación no encontrada.');
  return { recipe: r, version: v };
}

/** Current version of a visible (not hidden) recipe, used for new meal entries. */
export function currentRecipeVersion(profileId: string, recipeId: string) {
  const r = ownRecipe(profileId, recipeId);
  return recipeVersionFor(profileId, r.id, r.currentVersionId ?? undefined);
}

function nextVersionNo(d: Db, recipeId: string): number {
  const r = d.select({ n: sql<number>`coalesce(max(${recipeVersion.versionNo}), 0)` }).from(recipeVersion).where(eq(recipeVersion.recipeId, recipeId)).get();
  return (r?.n ?? 0) + 1;
}

function resolveIngredient(profileId: string, it: { foodId: string; quantity: number; unit: 'g' | 'ml' }) {
  const f: FoodRow = visibleFood(profileId, it.foodId);
  const { version, isOverride } = effectiveVersion(profileId, f);
  return { food: f, version, isOverride, item: it };
}

function insertVersion(d: Db, profileId: string, recipeId: string, input: RecipeInput): string {
  const resolved = input.ingredients.map((it) => resolveIngredient(profileId, it));
  let result;
  try {
    result = computePreparation({
      ingredients: resolved.map(({ version, item }) => ({
        quantity: item.quantity,
        unit: item.unit,
        basis: version.basis,
        densityGPerMl: version.densityGPerMl,
        per100: per100OfVersion(version),
      })),
      servings: input.servings ?? null,
      yield: input.yieldQuantity != null && input.yieldUnit ? { quantity: input.yieldQuantity, unit: input.yieldUnit } : null,
    });
  } catch (e) {
    asApiError(e, 'ingredients');
  }
  const id = newId();
  d.insert(recipeVersion)
    .values({
      id,
      recipeId,
      versionNo: nextVersionNo(d, recipeId),
      notes: input.notes ?? null,
      servings: input.servings ?? null,
      yieldQuantity: input.yieldQuantity ?? null,
      yieldUnit: input.yieldUnit ?? null,
      homogeneous: input.homogeneous ?? true,
      approximate: result.approximate,
      ...result.totals,
      createdAt: nowIso(),
    })
    .run();
  resolved.forEach(({ food: f, version: v, isOverride, item }, position) => {
    const c = result.ingredients[position]!;
    d.insert(recipeIngredient)
      .values({
        id: newId(),
        recipeVersionId: id,
        position,
        foodId: f.id,
        foodVersionId: v.id,
        quantity: item.quantity,
        unit: item.unit,
        approximate: c.approximate,
        snapName: f.nameEs,
        snapBrand: f.brand,
        snapPreparationState: f.preparationState,
        snapProductForm: f.productForm,
        snapDataSourceId: isOverride ? 'user_correction' : v.dataSourceId,
        snapSourceVersion: v.sourceVersion,
        snapBasis: v.basis,
        snapDensityGPerMl: v.densityGPerMl,
        snapKcalPer100: v.kcal,
        snapProteinPer100: v.proteinG,
        snapCarbsPer100: v.carbsG,
        snapFatPer100: v.fatG,
        snapFiberPer100: v.fiberG,
        snapSugarPer100: v.sugarG,
        snapSodiumPer100: v.sodiumMg,
        ...c.nutrients,
      })
      .run();
  });
  return id;
}

export function createRecipe(profileId: string, input: RecipeInput) {
  const id = newId();
  const ts = nowIso();
  tx((d) => {
    d.insert(recipe).values({ id, profileId, name: input.name, currentVersionId: null, hiddenAt: null, createdAt: ts, updatedAt: ts }).run();
    const versionId = insertVersion(d, profileId, id, input);
    d.update(recipe).set({ currentVersionId: versionId }).where(eq(recipe.id, id)).run();
  });
  return getRecipe(profileId, id);
}

/** Saving changes creates a new version; previous versions (and meals using them) stay untouched. */
export function updateRecipe(profileId: string, recipeId: string, input: RecipeInput) {
  ownRecipe(profileId, recipeId);
  tx((d) => {
    const versionId = insertVersion(d, profileId, recipeId, input);
    d.update(recipe).set({ name: input.name, currentVersionId: versionId, updatedAt: nowIso() }).where(eq(recipe.id, recipeId)).run();
  });
  return getRecipe(profileId, recipeId);
}

/** Soft delete: hidden from lists; meals that used it keep their snapshots. */
export function hideRecipe(profileId: string, recipeId: string): void {
  ownRecipe(profileId, recipeId);
  db().update(recipe).set({ hiddenAt: nowIso() }).where(eq(recipe.id, recipeId)).run();
}

export interface RecipeView {
  id: string;
  name: string;
  hidden: boolean;
  versionId: string;
  versionNo: number;
  isCurrentVersion: boolean;
  notes: string | null;
  servings: number | null;
  yield: { quantity: number; unit: 'g' | 'ml' } | null;
  homogeneous: boolean;
  approximate: boolean;
  ingredients: {
    foodId: string;
    foodVersionId: string;
    name: string;
    brand: string | null;
    preparationState: IngredientRow['snapPreparationState'];
    productForm: IngredientRow['snapProductForm'];
    source: string;
    quantity: number;
    unit: 'g' | 'ml';
    approximate: boolean;
    nutrients: Nutrients;
    per100: { basis: 'g' | 'ml'; densityGPerMl: number | null; kcal: number; proteinG: number; carbsG: number; fatG: number };
  }[];
  /** The complete preparation. */
  totals: Nutrients;
  incompleteNutrients: OptionalNutrient[];
  perServing: Nutrients | null;
  per100OfYield: (Nutrients & { unit: 'g' | 'ml' }) | null;
  updatedAt: string;
}

export function getRecipe(profileId: string, recipeId: string, versionId?: string): RecipeView {
  const { recipe: r, version: v } = recipeVersionFor(profileId, recipeId, versionId);
  const rows = db().select().from(recipeIngredient).where(eq(recipeIngredient.recipeVersionId, v.id)).orderBy(asc(recipeIngredient.position)).all();
  // Recomputed from the version's own ingredient snapshots: identical to the stored totals.
  const computed = computePreparation({
    ingredients: rows.map(ingredientInputFromRow),
    servings: v.servings,
    yield: versionFacts(v).yield,
  });
  const totals = versionTotals(v);
  return {
    id: r.id,
    name: r.name,
    hidden: r.hiddenAt !== null,
    versionId: v.id,
    versionNo: v.versionNo,
    isCurrentVersion: r.currentVersionId === v.id,
    notes: v.notes,
    servings: v.servings,
    yield: versionFacts(v).yield,
    homogeneous: v.homogeneous,
    approximate: v.approximate,
    ingredients: rows.map((row) => ({
      foodId: row.foodId,
      foodVersionId: row.foodVersionId,
      name: row.snapName,
      brand: row.snapBrand,
      preparationState: row.snapPreparationState,
      productForm: row.snapProductForm,
      source: row.snapDataSourceId,
      quantity: row.quantity,
      unit: row.unit,
      approximate: row.approximate,
      nutrients: { kcal: row.kcal, proteinG: row.proteinG, carbsG: row.carbsG, fatG: row.fatG, fiberG: row.fiberG, sugarG: row.sugarG, sodiumMg: row.sodiumMg },
      per100: {
        basis: row.snapBasis,
        densityGPerMl: row.snapDensityGPerMl,
        kcal: row.snapKcalPer100,
        proteinG: row.snapProteinPer100,
        carbsG: row.snapCarbsPer100,
        fatG: row.snapFatPer100,
      },
    })),
    totals,
    incompleteNutrients: computed.incomplete,
    perServing: v.servings ? scaleBy(totals, 1 / v.servings) : null,
    per100OfYield: v.yieldQuantity && v.yieldUnit ? { ...scaleBy(totals, 100 / v.yieldQuantity), unit: v.yieldUnit } : null,
    updatedAt: r.updatedAt,
  };
}

export function listRecipes(profileId: string): RecipeView[] {
  return db()
    .select({ id: recipe.id })
    .from(recipe)
    .where(and(eq(recipe.profileId, profileId), isNull(recipe.hiddenAt)))
    .orderBy(desc(recipe.updatedAt), asc(recipe.name))
    .all()
    .map((r) => getRecipe(profileId, r.id));
}
