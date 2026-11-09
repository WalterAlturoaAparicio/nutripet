/**
 * Meal journal (FR-030–FR-037). Entries snapshot the nutrition values used at logging time;
 * editing quantity recomputes from that snapshot, so catalog updates never change history (FR-033).
 */
import { and, asc, eq } from 'drizzle-orm';
import { QUANTITY_CONFIRM_ABOVE } from '@/domain/config';
import { scaleNutrients, sumNutrients } from '@/domain/nutrition';
import type { LocalDate, Nutrients, NutrientsPer100, Occasion, OptionalNutrient } from '@/domain/types';
import { OCCASIONS } from '@/domain/types';
import { db, tx, type Db } from '../../db/client';
import { meal, mealEntry } from '../../db/schema';
import { newId } from '../../db/ids';
import { nowIso } from '../../clock';
import { confirmRequired, notFound } from '../../http/errors';
import type { AddEntryInput, UpdateEntryInput } from '../../validation/journal';
import { effectiveVersion, visibleFood, type FoodRow, type FoodVersionRow } from '../foods/service';
import { ensureDaySnapshot, getDayEnergy } from '../day-energy/service';
import { assertNotFuture } from '../profiles/time';
import { applyDaySummaryExtensions, emitTracking } from '../events';
import '../register';

export type EntryRow = typeof mealEntry.$inferSelect;
type MealRow = typeof meal.$inferSelect;

export interface EntryView {
  id: string;
  mealId: string;
  foodId: string;
  name: string;
  brand: string | null;
  preparationState: EntryRow['snapPreparationState'];
  source: string;
  sourceVersion: string;
  quantity: number;
  unit: 'g' | 'ml';
  approximate: boolean;
  eatenAt: string;
  note: string | null;
  nutrients: Nutrients;
  /** The snapshot values this entry is computed from (per 100 of its basis). */
  per100: { basis: 'g' | 'ml'; densityGPerMl: number | null; kcal: number; proteinG: number; carbsG: number; fatG: number };
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

const per100FromSnapshot = (e: EntryRow): NutrientsPer100 => ({
  kcal: e.snapKcalPer100,
  proteinG: e.snapProteinPer100,
  carbsG: e.snapCarbsPer100,
  fatG: e.snapFatPer100,
  fiberG: e.snapFiberPer100,
  sugarG: e.snapSugarPer100,
  sodiumMg: e.snapSodiumPer100,
});

function snapshotFields(f: FoodRow, v: FoodVersionRow, isOverride: boolean) {
  return {
    foodId: f.id,
    foodVersionId: v.id,
    snapName: f.nameEs,
    snapBrand: f.brand,
    snapPreparationState: f.preparationState,
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

function amounts(per100: NutrientsPer100, quantity: number, unit: 'g' | 'ml', basis: 'g' | 'ml', density: number | null) {
  const { nutrients, approximate } = scaleNutrients(per100, quantity, unit, basis, density);
  return { ...nutrients, approximate };
}

function checkQuantity(quantity: number, confirm?: boolean): void {
  if (quantity > QUANTITY_CONFIRM_ABOVE && !confirm) throw confirmRequired('large_quantity');
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

function insertEntry(
  d: Db,
  profileId: string,
  date: LocalDate,
  m: MealRow,
  item: { foodId: string; quantity: number; unit: 'g' | 'ml'; eatenAt?: string; note?: string | null },
): EntryRow {
  const f = visibleFood(profileId, item.foodId);
  const { version, isOverride } = effectiveVersion(profileId, f);
  const a = amounts(per100FromVersion(version), item.quantity, item.unit, version.basis, version.densityGPerMl);
  const ts = nowIso();
  const row: EntryRow = {
    id: newId(),
    profileId,
    mealId: m.id,
    localDate: date,
    ...snapshotFields(f, version, isOverride),
    quantity: item.quantity,
    unit: item.unit,
    approximate: a.approximate,
    eatenAt: item.eatenAt ?? ts,
    note: item.note ?? null,
    kcal: a.kcal,
    proteinG: a.proteinG,
    carbsG: a.carbsG,
    fatG: a.fatG,
    fiberG: a.fiberG,
    sugarG: a.sugarG,
    sodiumMg: a.sodiumMg,
    createdAt: ts,
    updatedAt: ts,
  };
  d.insert(mealEntry).values(row).run();
  return row;
}

export function addEntry(profileId: string, date: LocalDate, input: AddEntryInput) {
  assertNotFuture(profileId, date);
  checkQuantity(input.quantity, input.confirm);
  visibleFood(profileId, input.foodId);
  ensureDaySnapshot(profileId, date);
  const entry = tx((d) => insertEntry(d, profileId, date, findOrCreateMeal(d, profileId, date, input.occasion, input.label), input));
  emitTracking({ profileId, date, kind: 'food_entry', recordId: entry.id, action: 'created' });
  return { entry: toEntryView(entry), day: getDaySummary(profileId, date) };
}

export function addBatch(
  profileId: string,
  date: LocalDate,
  input: { occasion: Occasion; label?: string; items: { foodId: string; quantity: number; unit: 'g' | 'ml' }[]; confirm?: boolean },
) {
  assertNotFuture(profileId, date);
  for (const it of input.items) {
    checkQuantity(it.quantity, input.confirm);
    visibleFood(profileId, it.foodId);
  }
  ensureDaySnapshot(profileId, date);
  const entries = tx((d) => {
    const m = findOrCreateMeal(d, profileId, date, input.occasion, input.label);
    return input.items.map((it) => insertEntry(d, profileId, date, m, it));
  });
  for (const e of entries) emitTracking({ profileId, date, kind: 'food_entry', recordId: e.id, action: 'created' });
  return { entries: entries.map(toEntryView), day: getDaySummary(profileId, date) };
}

export function updateEntry(profileId: string, entryId: string, patch: UpdateEntryInput) {
  const current = getOwnEntry(profileId, entryId);
  const quantity = patch.quantity ?? current.quantity;
  const unit = patch.unit ?? current.unit;
  if (patch.quantity !== undefined) checkQuantity(quantity, patch.confirm);

  const updated = tx((d) => {
    let next: EntryRow = { ...current, quantity, unit, updatedAt: nowIso() };
    if (patch.note !== undefined) next.note = patch.note ?? null;
    if (patch.eatenAt) next.eatenAt = patch.eatenAt;
    if (patch.foodId && patch.foodId !== current.foodId) {
      // Changing the food re-snapshots from the new food's effective version.
      const f = visibleFood(profileId, patch.foodId);
      const { version, isOverride } = effectiveVersion(profileId, f);
      next = { ...next, ...snapshotFields(f, version, isOverride) };
    }
    // Quantity/unit changes recompute from the entry's own snapshot, never from the current catalog.
    const a = amounts(per100FromSnapshot(next), next.quantity, next.unit, next.snapBasis, next.snapDensityGPerMl);
    next = { ...next, approximate: a.approximate, kcal: a.kcal, proteinG: a.proteinG, carbsG: a.carbsG, fatG: a.fatG, fiberG: a.fiberG, sugarG: a.sugarG, sodiumMg: a.sodiumMg };
    if (patch.occasion) {
      const m = findOrCreateMeal(d, profileId, current.localDate, patch.occasion, patch.label);
      next.mealId = m.id;
    }
    const { id: _id, ...values } = next;
    d.update(mealEntry).set(values).where(eq(mealEntry.id, entryId)).run();
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

export function mealItems(profileId: string, mealId: string) {
  getOwnMeal(profileId, mealId);
  return db()
    .select({ foodId: mealEntry.foodId, quantity: mealEntry.quantity, unit: mealEntry.unit })
    .from(mealEntry)
    .where(eq(mealEntry.mealId, mealId))
    .orderBy(asc(mealEntry.eatenAt))
    .all();
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
    foodId: e.foodId,
    name: e.snapName,
    brand: e.snapBrand,
    preparationState: e.snapPreparationState,
    source: e.snapDataSourceId,
    sourceVersion: e.snapSourceVersion,
    quantity: e.quantity,
    unit: e.unit,
    approximate: e.approximate,
    eatenAt: e.eatenAt,
    note: e.note,
    nutrients: { kcal: e.kcal, proteinG: e.proteinG, carbsG: e.carbsG, fatG: e.fatG, fiberG: e.fiberG, sugarG: e.sugarG, sodiumMg: e.sodiumMg },
    per100: {
      basis: e.snapBasis,
      densityGPerMl: e.snapDensityGPerMl,
      kcal: e.snapKcalPer100,
      proteinG: e.snapProteinPer100,
      carbsG: e.snapCarbsPer100,
      fatG: e.snapFatPer100,
    },
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
