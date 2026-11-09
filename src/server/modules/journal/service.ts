/**
 * Meal journal (FR-030–FR-037, FR-035a, FR-045). A meal holds any number of entries. Each entry
 * snapshots the values used at logging time:
 *  - food entries: the food version's values per 100 (editing quantity recomputes from them);
 *  - recipe entries: the exact recipe version (editing the portion recomputes from that version).
 * Catalog updates and recipe edits therefore never change history (FR-033, FR-046).
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import { QUANTITY_CONFIRM_ABOVE } from '@/domain/config';
import { portionNutrients, scaleBy, scaleNutrients, sumNutrients, type Portion } from '@/domain/nutrition';
import type { LocalDate, Nutrients, NutrientsPer100, Occasion, OptionalNutrient } from '@/domain/types';
import { OCCASIONS } from '@/domain/types';
import { db, tx, type Db } from '../../db/client';
import { meal, mealEntry } from '../../db/schema';
import { newId } from '../../db/ids';
import { nowIso } from '../../clock';
import { ApiError, confirmRequired, notFound } from '../../http/errors';
import type { AddEntryInput, MealItemInput, PortionInput, UpdateEntryInput, UpdateMealInput } from '../../validation/journal';
import { effectiveVersion, visibleFood, type FoodRow, type FoodVersionRow } from '../foods/service';
import { asApiError, currentRecipeVersion, recipeVersionFor, versionFacts, type RecipeRow, type RecipeVersionRow } from '../recipes/service';
import { ensureDaySnapshot, getDayEnergy } from '../day-energy/service';
import { assertNotFuture } from '../profiles/time';
import { applyDaySummaryExtensions, emitTracking } from '../events';
import '../register';

export type EntryRow = typeof mealEntry.$inferSelect;
type MealRow = typeof meal.$inferSelect;

export interface EntryView {
  id: string;
  mealId: string;
  kind: 'food' | 'recipe';
  foodId: string | null;
  name: string;
  brand: string | null;
  preparationState: EntryRow['snapPreparationState'];
  productForm: EntryRow['snapProductForm'];
  source: string;
  sourceVersion: string;
  /** Consumed amount; null for a recipe portion whose final yield is unknown. */
  quantity: number | null;
  unit: 'g' | 'ml' | null;
  approximate: boolean;
  eatenAt: string;
  note: string | null;
  nutrients: Nutrients;
  /** The snapshot values this entry is computed from (per 100 of its basis); null when unknown. */
  per100: { basis: 'g' | 'ml'; densityGPerMl: number | null; kcal: number; proteinG: number; carbsG: number; fatG: number } | null;
  /** Present for recipe entries: which version and which part of it was consumed. */
  recipe: {
    recipeId: string;
    recipeVersionId: string;
    portion: { mode: 'whole' | 'servings' | 'amount'; servings: number | null; factor: number };
  } | null;
}

export interface MealView {
  id: string;
  occasion: Occasion;
  label: string | null;
  entries: EntryView[];
  totals: Nutrients;
}

export interface DaySummary {
  date: LocalDate;
  status: string | null;
  foodCompleted: boolean | null;
  meals: MealView[];
  activities: unknown[];
  totals: Nutrients;
  incompleteNutrients: OptionalNutrient[];
  target: {
    activeKcal: number;
    recommendedKcal: number;
    isOverride: boolean;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    remainingKcal: number;
  };
  estimates: unknown;
  xpAwarded?: { source: string; amount: number }[];
  flags?: { restDay: boolean; markedComplete: boolean };
}

const per100FromVersion = (v: FoodVersionRow): NutrientsPer100 => ({
  kcal: v.kcal,
  proteinG: v.proteinG,
  carbsG: v.carbsG,
  fatG: v.fatG,
  fiberG: v.fiberG,
  sugarG: v.sugarG,
  sodiumMg: v.sodiumMg,
});

/** Food entries always carry a full per-100 snapshot. */
function per100FromSnapshot(e: EntryRow): NutrientsPer100 {
  if (e.snapKcalPer100 === null || e.snapProteinPer100 === null || e.snapCarbsPer100 === null || e.snapFatPer100 === null) {
    throw new Error(`meal_entry ${e.id} has no per-100 snapshot`);
  }
  return {
    kcal: e.snapKcalPer100,
    proteinG: e.snapProteinPer100,
    carbsG: e.snapCarbsPer100,
    fatG: e.snapFatPer100,
    fiberG: e.snapFiberPer100,
    sugarG: e.snapSugarPer100,
    sodiumMg: e.snapSodiumPer100,
  };
}

const NO_RECIPE = { recipeId: null, recipeVersionId: null, portionMode: null, portionServings: null, portionFactor: null } as const;

function foodSnapshotFields(f: FoodRow, v: FoodVersionRow, isOverride: boolean) {
  return {
    kind: 'food' as const,
    foodId: f.id,
    foodVersionId: v.id,
    ...NO_RECIPE,
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
  };
}

function foodAmounts(per100: NutrientsPer100, quantity: number, unit: 'g' | 'ml', basis: 'g' | 'ml', density: number | null) {
  const { nutrients, approximate } = scaleNutrients(per100, quantity, unit, basis, density);
  return { ...nutrients, approximate };
}

/**
 * Snapshot + nutrients of a recipe portion, always from the given (immutable) recipe version.
 * Per-100 values describe the final preparation and exist only when its yield was entered.
 */
function recipeFields(r: RecipeRow, v: RecipeVersionRow, portion: PortionInput) {
  const facts = versionFacts(v);
  let calc: { nutrients: Nutrients; factor: number };
  try {
    calc = portionNutrients(facts, portion as Portion);
  } catch (e) {
    asApiError(e);
  }
  const per100 = facts.yield ? scaleBy(facts.totals, 100 / facts.yield.quantity) : null;
  const consumed =
    portion.mode === 'amount'
      ? { quantity: portion.quantity, unit: portion.unit }
      : facts.yield
        ? { quantity: facts.yield.quantity * calc.factor, unit: facts.yield.unit }
        : { quantity: null, unit: null };
  return {
    kind: 'recipe' as const,
    foodId: null,
    foodVersionId: null,
    recipeId: r.id,
    recipeVersionId: v.id,
    portionMode: portion.mode,
    portionServings: portion.mode === 'servings' ? portion.servings : null,
    portionFactor: calc.factor,
    ...consumed,
    approximate: v.approximate,
    snapName: r.name,
    snapBrand: null,
    snapPreparationState: 'prepared' as const,
    snapProductForm: 'as_sold' as const,
    snapDataSourceId: 'recipe',
    snapSourceVersion: `v${v.versionNo}`,
    snapBasis: facts.yield?.unit ?? null,
    snapDensityGPerMl: null,
    snapKcalPer100: per100?.kcal ?? null,
    snapProteinPer100: per100?.proteinG ?? null,
    snapCarbsPer100: per100?.carbsG ?? null,
    snapFatPer100: per100?.fatG ?? null,
    snapFiberPer100: per100?.fiberG ?? null,
    snapSugarPer100: per100?.sugarG ?? null,
    snapSodiumPer100: per100?.sodiumMg ?? null,
    ...calc.nutrients,
  };
}

function checkQuantity(quantity: number, confirm?: boolean): void {
  if (quantity > QUANTITY_CONFIRM_ABOVE && !confirm) throw confirmRequired('large_quantity');
}

const isRecipeItem = (it: MealItemInput): it is Extract<MealItemInput, { recipeId: string }> => 'recipeId' in it;

/** Validates every item before anything is written, so a meal is saved completely or not at all. */
function precheckItems(profileId: string, items: MealItemInput[], confirm?: boolean): void {
  for (const it of items) {
    if (isRecipeItem(it)) {
      currentRecipeVersion(profileId, it.recipeId);
      if (it.portion.mode === 'amount') checkQuantity(it.portion.quantity, confirm);
    } else {
      checkQuantity(it.quantity, confirm);
      visibleFood(profileId, it.foodId);
    }
  }
}

function findOrCreateMeal(d: Db, profileId: string, date: LocalDate, occasion: Occasion, label?: string | null): MealRow {
  const existing = d
    .select()
    .from(meal)
    .where(and(eq(meal.profileId, profileId), eq(meal.localDate, date), eq(meal.occasion, occasion)))
    .all()
    .find((m) => occasion !== 'extra' || (m.label ?? '').toLowerCase() === (label ?? '').toLowerCase());
  if (existing) return existing;
  const row: MealRow = { id: newId(), profileId, localDate: date, occasion, label: occasion === 'extra' ? (label ?? null) : null, createdAt: nowIso() };
  d.insert(meal).values(row).run();
  return row;
}

function getOwnEntry(profileId: string, entryId: string): EntryRow {
  const row = db().select().from(mealEntry).where(and(eq(mealEntry.id, entryId), eq(mealEntry.profileId, profileId))).get();
  if (!row) throw notFound('Registro no encontrado.');
  return row;
}

function deleteMealIfEmpty(d: Db, mealId: string): void {
  const left = d.select({ id: mealEntry.id }).from(mealEntry).where(eq(mealEntry.mealId, mealId)).get();
  if (!left) d.delete(meal).where(eq(meal.id, mealId)).run();
}

function insertItem(
  d: Db,
  profileId: string,
  date: LocalDate,
  m: MealRow,
  item: MealItemInput & { eatenAt?: string; note?: string | null },
): EntryRow {
  const ts = nowIso();
  const base = { id: newId(), profileId, mealId: m.id, localDate: date, eatenAt: item.eatenAt ?? ts, note: item.note ?? null, createdAt: ts, updatedAt: ts };
  let row: EntryRow;
  if (isRecipeItem(item)) {
    const { recipe: r, version } = currentRecipeVersion(profileId, item.recipeId);
    row = { ...base, ...recipeFields(r, version, item.portion) };
  } else {
    const f = visibleFood(profileId, item.foodId);
    const { version, isOverride } = effectiveVersion(profileId, f);
    const a = foodAmounts(per100FromVersion(version), item.quantity, item.unit, version.basis, version.densityGPerMl);
    row = {
      ...base,
      ...foodSnapshotFields(f, version, isOverride),
      quantity: item.quantity,
      unit: item.unit,
      approximate: a.approximate,
      kcal: a.kcal,
      proteinG: a.proteinG,
      carbsG: a.carbsG,
      fatG: a.fatG,
      fiberG: a.fiberG,
      sugarG: a.sugarG,
      sodiumMg: a.sodiumMg,
    };
  }
  d.insert(mealEntry).values(row).run();
  return row;
}

/**
 * Applies a quantity/portion change to an existing entry, recomputing from the entry's OWN
 * snapshot (food) or its OWN recipe version (recipe), never from the current catalog or recipe.
 */
function recompute(profileId: string, current: EntryRow, change: { quantity?: number; unit?: 'g' | 'ml'; portion?: PortionInput }): EntryRow {
  if (current.kind === 'recipe') {
    if (change.quantity !== undefined || change.unit !== undefined) {
      throw new ApiError('VALIDATION', 'Para una preparación, cambia la porción consumida.', { fields: { portion: 'Indica la porción consumida.' } });
    }
    if (!change.portion) return current;
    const { recipe: r, version } = recipeVersionFor(profileId, current.recipeId!, current.recipeVersionId!);
    const { snapName: _keepName, ...fields } = recipeFields(r, version, change.portion);
    return { ...current, ...fields };
  }
  if (change.portion) {
    throw new ApiError('VALIDATION', 'La porción solo aplica a preparaciones.', { fields: { portion: 'Usa cantidad y unidad.' } });
  }
  const next = { ...current, quantity: change.quantity ?? current.quantity, unit: change.unit ?? current.unit };
  const a = foodAmounts(per100FromSnapshot(next), next.quantity!, next.unit!, next.snapBasis!, next.snapDensityGPerMl);
  return { ...next, approximate: a.approximate, kcal: a.kcal, proteinG: a.proteinG, carbsG: a.carbsG, fatG: a.fatG, fiberG: a.fiberG, sugarG: a.sugarG, sodiumMg: a.sodiumMg };
}

function writeEntry(d: Db, next: EntryRow): void {
  const { id, ...values } = next;
  d.update(mealEntry).set(values).where(eq(mealEntry.id, id)).run();
}

export function addEntry(profileId: string, date: LocalDate, input: AddEntryInput) {
  assertNotFuture(profileId, date);
  precheckItems(profileId, [input], input.confirm);
  ensureDaySnapshot(profileId, date);
  const entry = tx((d) => insertItem(d, profileId, date, findOrCreateMeal(d, profileId, date, input.occasion, input.label), input));
  emitTracking({ profileId, date, kind: 'food_entry', recordId: entry.id, action: 'created' });
  return { entry: toEntryView(entry), day: getDaySummary(profileId, date) };
}

/** Logs a complete multi-item meal in one transaction (FR-035a). */
export function addBatch(profileId: string, date: LocalDate, input: { occasion: Occasion; label?: string; items: MealItemInput[]; confirm?: boolean }) {
  assertNotFuture(profileId, date);
  precheckItems(profileId, input.items, input.confirm);
  ensureDaySnapshot(profileId, date);
  const entries = tx((d) => {
    const m = findOrCreateMeal(d, profileId, date, input.occasion, input.label);
    return input.items.map((it) => insertItem(d, profileId, date, m, it));
  });
  for (const e of entries) emitTracking({ profileId, date, kind: 'food_entry', recordId: e.id, action: 'created' });
  return { mealId: entries[0]!.mealId, entries: entries.map(toEntryView), day: getDaySummary(profileId, date) };
}

export function updateEntry(profileId: string, entryId: string, patch: UpdateEntryInput) {
  const current = getOwnEntry(profileId, entryId);
  if (patch.quantity !== undefined) checkQuantity(patch.quantity, patch.confirm);
  if (patch.portion?.mode === 'amount') checkQuantity(patch.portion.quantity, patch.confirm);

  const updated = tx((d) => {
    let next: EntryRow = { ...current, updatedAt: nowIso() };
    if (patch.note !== undefined) next.note = patch.note ?? null;
    if (patch.eatenAt) next.eatenAt = patch.eatenAt;
    if (patch.foodId && patch.foodId !== current.foodId) {
      if (current.kind === 'recipe') throw new ApiError('VALIDATION', 'Una preparación no se puede cambiar por un alimento.');
      // Changing the food re-snapshots from the new food's effective version.
      const f = visibleFood(profileId, patch.foodId);
      const { version, isOverride } = effectiveVersion(profileId, f);
      next = { ...next, ...foodSnapshotFields(f, version, isOverride) };
    }
    next = recompute(profileId, next, { quantity: patch.quantity, unit: patch.unit, portion: patch.portion });
    if (patch.occasion) next.mealId = findOrCreateMeal(d, profileId, current.localDate, patch.occasion, patch.label).id;
    writeEntry(d, next);
    if (next.mealId !== current.mealId) deleteMealIfEmpty(d, current.mealId);
    return next;
  });
  emitTracking({ profileId, date: current.localDate, kind: 'food_entry', recordId: entryId, action: 'updated' });
  return { entry: toEntryView(updated), day: getDaySummary(profileId, current.localDate) };
}

export function deleteEntry(profileId: string, entryId: string) {
  const current = getOwnEntry(profileId, entryId);
  tx((d) => {
    d.delete(mealEntry).where(eq(mealEntry.id, entryId)).run();
    deleteMealIfEmpty(d, current.mealId);
  });
  emitTracking({ profileId, date: current.localDate, kind: 'food_entry', recordId: entryId, action: 'deleted' });
  return { day: getDaySummary(profileId, current.localDate) };
}

export function getOwnMeal(profileId: string, mealId: string): MealRow {
  const m = db().select().from(meal).where(and(eq(meal.id, mealId), eq(meal.profileId, profileId))).get();
  if (!m) throw notFound('Comida no encontrada.');
  return m;
}

function mealEntryRows(mealId: string): EntryRow[] {
  return db().select().from(mealEntry).where(eq(mealEntry.mealId, mealId)).orderBy(asc(mealEntry.eatenAt), asc(mealEntry.createdAt)).all();
}

/** A meal's items as reusable inputs (foods with quantity, recipes with their portion). */
export function mealItems(profileId: string, mealId: string): MealItemInput[] {
  getOwnMeal(profileId, mealId);
  return mealEntryRows(mealId).map((e): MealItemInput => {
    if (e.kind === 'recipe') {
      const portion: PortionInput =
        e.portionMode === 'servings'
          ? { mode: 'servings', servings: e.portionServings! }
          : e.portionMode === 'amount'
            ? { mode: 'amount', quantity: e.quantity!, unit: e.unit! }
            : { mode: 'whole' };
      return { recipeId: e.recipeId!, portion };
    }
    return { foodId: e.foodId!, quantity: e.quantity!, unit: e.unit! };
  });
}

/**
 * Saves the full content of an existing meal (FR-035a): kept entries change only quantity/portion
 * (recomputed from their own snapshots), new items are snapshotted now, omitted entries are removed.
 * Everything happens in one transaction.
 */
export function updateMeal(profileId: string, mealId: string, input: UpdateMealInput) {
  const m = getOwnMeal(profileId, mealId);
  const existing = mealEntryRows(mealId);
  const byId = new Map(existing.map((e) => [e.id, e]));
  const kept = new Set<string>();
  const additions: MealItemInput[] = [];
  const changes: { current: EntryRow; change: { quantity?: number; unit?: 'g' | 'ml'; portion?: PortionInput } }[] = [];
  for (const it of input.items) {
    if ('entryId' in it) {
      const current = byId.get(it.entryId);
      if (!current) throw notFound('Registro no encontrado en esta comida.');
      if (kept.has(it.entryId)) throw new ApiError('VALIDATION', 'Un registro aparece dos veces.');
      kept.add(it.entryId);
      if ('portion' in it) {
        if (it.portion.mode === 'amount') checkQuantity(it.portion.quantity, input.confirm);
        changes.push({ current, change: { portion: it.portion } });
      } else {
        checkQuantity(it.quantity, input.confirm);
        changes.push({ current, change: { quantity: it.quantity, unit: it.unit } });
      }
    } else additions.push(it);
  }
  precheckItems(profileId, additions, input.confirm);
  const removed = existing.filter((e) => !kept.has(e.id));
  const result = tx((d) => {
    const updated: EntryRow[] = [];
    for (const { current, change } of changes) {
      const next = recompute(profileId, current, change);
      if (next !== current) {
        const stamped = { ...next, updatedAt: nowIso() };
        writeEntry(d, stamped);
        updated.push(stamped);
      }
    }
    const created = additions.map((it) => insertItem(d, profileId, m.localDate, m, it));
    if (removed.length) d.delete(mealEntry).where(inArray(mealEntry.id, removed.map((e) => e.id))).run();
    return { updated, created };
  });
  const date = m.localDate;
  for (const e of result.updated) emitTracking({ profileId, date, kind: 'food_entry', recordId: e.id, action: 'updated' });
  for (const e of result.created) emitTracking({ profileId, date, kind: 'food_entry', recordId: e.id, action: 'created' });
  for (const e of removed) emitTracking({ profileId, date, kind: 'food_entry', recordId: e.id, action: 'deleted' });
  return { mealId, day: getDaySummary(profileId, date) };
}

/** Copies the foods and quantities of a meal to another date/occasion, logged with current values. */
export function duplicateMeal(profileId: string, mealId: string, to: { toDate: LocalDate; toOccasion: Occasion; label?: string }) {
  const items = mealItems(profileId, mealId);
  if (items.length === 0) throw notFound('La comida está vacía.');
  return addBatch(profileId, to.toDate, { occasion: to.toOccasion, label: to.label, items, confirm: true });
}

function toEntryView(e: EntryRow): EntryView {
  return {
    id: e.id,
    mealId: e.mealId,
    kind: e.kind,
    foodId: e.foodId,
    name: e.snapName,
    brand: e.snapBrand,
    preparationState: e.snapPreparationState,
    productForm: e.snapProductForm,
    source: e.snapDataSourceId,
    sourceVersion: e.snapSourceVersion,
    quantity: e.quantity,
    unit: e.unit,
    approximate: e.approximate,
    eatenAt: e.eatenAt,
    note: e.note,
    nutrients: { kcal: e.kcal, proteinG: e.proteinG, carbsG: e.carbsG, fatG: e.fatG, fiberG: e.fiberG, sugarG: e.sugarG, sodiumMg: e.sodiumMg },
    per100:
      e.snapBasis !== null && e.snapKcalPer100 !== null && e.snapProteinPer100 !== null && e.snapCarbsPer100 !== null && e.snapFatPer100 !== null
        ? {
            basis: e.snapBasis,
            densityGPerMl: e.snapDensityGPerMl,
            kcal: e.snapKcalPer100,
            proteinG: e.snapProteinPer100,
            carbsG: e.snapCarbsPer100,
            fatG: e.snapFatPer100,
          }
        : null,
    recipe:
      e.kind === 'recipe'
        ? {
            recipeId: e.recipeId!,
            recipeVersionId: e.recipeVersionId!,
            portion: { mode: e.portionMode ?? 'whole', servings: e.portionServings, factor: e.portionFactor ?? 1 },
          }
        : null,
  };
}

export function dayEntries(profileId: string, date: LocalDate): EntryRow[] {
  return db()
    .select()
    .from(mealEntry)
    .where(and(eq(mealEntry.profileId, profileId), eq(mealEntry.localDate, date)))
    .orderBy(asc(mealEntry.eatenAt), asc(mealEntry.createdAt))
    .all();
}

export function getDaySummary(profileId: string, date: LocalDate): DaySummary {
  const meals = db()
    .select()
    .from(meal)
    .where(and(eq(meal.profileId, profileId), eq(meal.localDate, date)))
    .all()
    .sort((a, b) => OCCASIONS.indexOf(a.occasion) - OCCASIONS.indexOf(b.occasion) || a.createdAt.localeCompare(b.createdAt));
  const entries = dayEntries(profileId, date).map(toEntryView);
  const mealViews: MealView[] = meals.map((m) => {
    const es = entries.filter((e) => e.mealId === m.id);
    return { id: m.id, occasion: m.occasion, label: m.label, entries: es, totals: sumNutrients(es.map((e) => e.nutrients)).totals };
  });
  const { totals, incomplete } = sumNutrients(entries.map((e) => e.nutrients));
  const { snapshot } = getDayEnergy(profileId, date);
  const summary: DaySummary = {
    date,
    status: null,
    foodCompleted: null,
    meals: mealViews,
    activities: [],
    totals,
    incompleteNutrients: incomplete,
    target: {
      activeKcal: snapshot.activeTargetKcal,
      recommendedKcal: snapshot.recommendedTargetKcal,
      isOverride: snapshot.targetIsOverride,
      proteinG: snapshot.proteinTargetG,
      carbsG: snapshot.carbsTargetG,
      fatG: snapshot.fatTargetG,
      remainingKcal: snapshot.activeTargetKcal - totals.kcal,
    },
    estimates: null,
  };
  return applyDaySummaryExtensions(profileId, date, summary);
}
