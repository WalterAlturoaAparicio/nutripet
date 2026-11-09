/**
 * Custom foods, profile-level corrections, favorites and quick lists (FR-026, FR-027, US4).
 * Corrections create a `user_correction` food version used only by that profile; past entries keep
 * their snapshots, and other profiles keep the catalog values.
 */
import { and, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { addDays } from '@/domain/dates';
import { db, tx, type Db } from '../../db/client';
import { food, foodAlias, foodFavorite, foodOverride, foodVersion, mealEntry } from '../../db/schema';
import { newId } from '../../db/ids';
import { nowIso } from '../../clock';
import { notFound } from '../../http/errors';
import type { CustomFoodInput, NutrientInput } from '../../validation/foods';
import { profileToday } from '../profiles/time';
import { listTemplates } from '../journal/templates';
import { getFood, searchFoods, visibleFood, type FoodSummary } from './service';

function nextVersionNo(d: Db, foodId: string): number {
  const r = d.select({ n: sql<number>`coalesce(max(${foodVersion.versionNo}), 0)` }).from(foodVersion).where(eq(foodVersion.foodId, foodId)).get();
  return (r?.n ?? 0) + 1;
}

function insertVersion(d: Db, foodId: string, source: 'user' | 'user_correction', n: NutrientInput | CustomFoodInput, label: string): string {
  const id = newId();
  d.insert(foodVersion)
    .values({
      id,
      foodId,
      versionNo: nextVersionNo(d, foodId),
      basis: n.basis,
      kcal: n.kcal,
      proteinG: n.proteinG,
      carbsG: n.carbsG,
      fatG: n.fatG,
      fiberG: n.fiberG ?? null,
      sugarG: n.sugarG ?? null,
      sodiumMg: n.sodiumMg ?? null,
      densityGPerMl: n.densityGPerMl ?? null,
      dataSourceId: source,
      sourceVersion: label,
      importRunId: null,
      createdAt: nowIso(),
    })
    .run();
  return id;
}

function setAliases(d: Db, foodId: string, aliases: string[]): void {
  d.delete(foodAlias).where(eq(foodAlias.foodId, foodId)).run();
  for (const alias of new Set(aliases.map((a) => a.trim()).filter(Boolean))) {
    d.insert(foodAlias).values({ foodId, alias, lang: 'es' }).onConflictDoNothing().run();
  }
}

function ownCustomFood(profileId: string, foodId: string) {
  const f = db().select().from(food).where(and(eq(food.id, foodId), eq(food.ownerProfileId, profileId))).get();
  if (!f) throw notFound('Alimento no encontrado.');
  return f;
}

export function createCustomFood(profileId: string, input: CustomFoodInput) {
  const id = newId();
  const ts = nowIso();
  const label = `Usuario ${profileToday(profileId)}`;
  tx((d) => {
    d.insert(food)
      .values({
        id,
        dataSourceId: 'user',
        sourceFoodId: null,
        ownerProfileId: profileId,
        nameEs: input.nameEs,
        nameEn: input.nameEn ?? null,
        category: input.category,
        preparationState: input.preparationState,
        brand: input.brand ?? null,
        productForm: input.productForm ?? 'as_sold',
        preparationInstructions: input.preparationInstructions ?? null,
        sourceNote: input.sourceNote,
        createdAt: ts,
        updatedAt: ts,
      })
      .run();
    setAliases(d, id, input.aliases ?? []);
    const versionId = insertVersion(d, id, 'user', input, label);
    d.update(food).set({ currentVersionId: versionId }).where(eq(food.id, id)).run();
  });
  return getFood(profileId, id);
}

export function updateCustomFood(
  profileId: string,
  foodId: string,
  patch: Partial<Omit<CustomFoodInput, keyof NutrientInput>> & { aliases?: string[]; nutrients?: NutrientInput },
) {
  ownCustomFood(profileId, foodId);
  tx((d) => {
    const { nutrients, aliases, ...meta } = patch;
    if (Object.keys(meta).length) d.update(food).set({ ...meta, updatedAt: nowIso() }).where(eq(food.id, foodId)).run();
    if (aliases) setAliases(d, foodId, aliases);
    if (nutrients) {
      const versionId = insertVersion(d, foodId, 'user', nutrients, `Usuario ${profileToday(profileId)}`);
      d.update(food).set({ currentVersionId: versionId, updatedAt: nowIso() }).where(eq(food.id, foodId)).run();
    }
  });
  return getFood(profileId, foodId);
}

/** Soft delete: hidden from search; entries that used it keep their snapshots. */
export function hideCustomFood(profileId: string, foodId: string): void {
  ownCustomFood(profileId, foodId);
  db().update(food).set({ hiddenAt: nowIso() }).where(eq(food.id, foodId)).run();
}

export function setOverride(profileId: string, foodId: string, input: NutrientInput) {
  const f = visibleFood(profileId, foodId);
  if (f.ownerProfileId === profileId) return updateCustomFood(profileId, foodId, { nutrients: input });
  tx((d) => {
    const versionId = insertVersion(d, foodId, 'user_correction', input, `Corrección ${profileToday(profileId)}${input.note ? `: ${input.note}` : ''}`);
    d.insert(foodOverride)
      .values({ id: newId(), profileId, foodId, foodVersionId: versionId, createdAt: nowIso() })
      .onConflictDoUpdate({ target: [foodOverride.profileId, foodOverride.foodId], set: { foodVersionId: versionId, createdAt: nowIso() } })
      .run();
  });
  return getFood(profileId, foodId);
}

export function removeOverride(profileId: string, foodId: string) {
  visibleFood(profileId, foodId);
  db().delete(foodOverride).where(and(eq(foodOverride.profileId, profileId), eq(foodOverride.foodId, foodId))).run();
  return getFood(profileId, foodId);
}

export function setFavorite(profileId: string, foodId: string, favorite: boolean): void {
  visibleFood(profileId, foodId);
  if (favorite) db().insert(foodFavorite).values({ profileId, foodId, createdAt: nowIso() }).onConflictDoNothing().run();
  else db().delete(foodFavorite).where(and(eq(foodFavorite.profileId, profileId), eq(foodFavorite.foodId, foodId))).run();
}

interface QuickFood extends FoodSummary {
  lastQuantity: number | null;
  lastUnit: 'g' | 'ml' | null;
}

function lastUse(profileId: string, foodId: string) {
  return db()
    .select({ quantity: mealEntry.quantity, unit: mealEntry.unit })
    .from(mealEntry)
    .where(and(eq(mealEntry.profileId, profileId), eq(mealEntry.foodId, foodId)))
    .orderBy(desc(mealEntry.createdAt), desc(sql`rowid`))
    .get();
}

function summaryFor(profileId: string, foodId: string): FoodSummary | null {
  const f = getFood(profileId, foodId);
  if (f.hidden) return null;
  return {
    id: f.id,
    nameEs: f.nameEs,
    nameEn: f.nameEn,
    category: f.category,
    preparationState: f.preparationState,
    brand: f.brand,
    productForm: f.productForm,
    basis: f.per100.basis,
    kcalPer100: f.per100.kcal,
    proteinPer100: f.per100.proteinG,
    carbsPer100: f.per100.carbsG,
    fatPer100: f.per100.fatG,
    densityGPerMl: f.per100.densityGPerMl,
    source: f.hasOverride ? 'user_correction' : f.source.id,
    isFavorite: f.isFavorite,
    isCustom: f.isCustom,
    hasOverride: f.hasOverride,
  };
}

function withLastUse(profileId: string, s: FoodSummary): QuickFood {
  const u = lastUse(profileId, s.id);
  return { ...s, lastQuantity: u?.quantity ?? null, lastUnit: u?.unit ?? null };
}

/** Favorites, most-logged foods of the last 30 days, and templates for one-tap re-logging (SC-002). */
export function quickLists(profileId: string) {
  const favIds = db().select({ id: foodFavorite.foodId }).from(foodFavorite).where(eq(foodFavorite.profileId, profileId)).all();
  const favorites = favIds.map((r) => summaryFor(profileId, r.id)).filter((x): x is FoodSummary => x !== null);
  const since = addDays(profileToday(profileId), -30);
  const frequentRows = db()
    .select({ id: mealEntry.foodId, n: sql<number>`count(*)` })
    .from(mealEntry)
    .where(and(eq(mealEntry.profileId, profileId), gte(mealEntry.localDate, since), isNotNull(mealEntry.foodId)))
    .groupBy(mealEntry.foodId)
    .orderBy(desc(sql`count(*)`))
    .limit(8)
    .all();
  const frequent = frequentRows.map((r) => summaryFor(profileId, r.id!)).filter((x): x is FoodSummary => x !== null);
  return {
    favorites: favorites.map((f) => withLastUse(profileId, f)),
    frequent: frequent.map((f) => withLastUse(profileId, f)),
    templates: listTemplates(profileId),
  };
}

export function myFoods(profileId: string): FoodSummary[] {
  return db()
    .select({ id: food.id })
    .from(food)
    .where(and(eq(food.ownerProfileId, profileId), sql`${food.hiddenAt} IS NULL`))
    .all()
    .map((r) => summaryFor(profileId, r.id))
    .filter((x): x is FoodSummary => x !== null);
}

export { searchFoods };
