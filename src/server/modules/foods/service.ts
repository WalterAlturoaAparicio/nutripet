/**
 * Food catalog reads (FR-020–FR-028). Search is accent/case-insensitive FTS5 prefix matching over
 * names, aliases (es/en) and brand. Profiles only see global foods and their own custom foods.
 */
import { and, eq, isNull, or } from 'drizzle-orm';
import { db, getDbHandle } from '../../db/client';
import { dataSource, food, foodAlias, foodVersion, type FoodCategory } from '../../db/schema';
import { notFound } from '../../http/errors';

export type FoodRow = typeof food.$inferSelect;
export type FoodVersionRow = typeof foodVersion.$inferSelect;

export interface FoodSummary {
  id: string;
  nameEs: string;
  nameEn: string | null;
  category: FoodCategory;
  preparationState: FoodRow['preparationState'];
  brand: string | null;
  /** 'dry_mix' / 'concentrate': values describe the product before preparation (FR-048). */
  productForm: FoodRow['productForm'];
  basis: 'g' | 'ml';
  kcalPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  densityGPerMl: number | null;
  source: string;
  isFavorite: boolean;
  isCustom: boolean;
  hasOverride: boolean;
}

export interface SearchParams {
  q?: string;
  category?: FoodCategory;
  state?: FoodRow['preparationState'];
  branded?: boolean;
  limit?: number;
}

function tokenize(q: string): string[] {
  return q
    .normalize('NFKC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0)
    .slice(0, 8)
    .map((t) => t.replace(/"/g, ''));
}

/**
 * Turns free text into an FTS5 query for search-as-you-type: earlier tokens must match whole words,
 * the last token (still being typed) matches as a prefix. "res coc" → "res" AND "coc"*.
 */
export function ftsQuery(q: string): string | null {
  const tokens = tokenize(q);
  if (tokens.length === 0) return null;
  return tokens.map((t, i) => (i === tokens.length - 1 ? `"${t}"*` : `"${t}"`)).join(' ');
}

/** Name starts with the first token (FTS5 initial-token query on name_es). */
export function ftsStartsQuery(q: string): string | null {
  const [first] = tokenize(q);
  return first ? `name_es : ^"${first}"*` : null;
}

/** All tokens as whole words; used to rank exact matches above prefix-only matches ("papa" before "papaya"). */
export function ftsExactQuery(q: string): string | null {
  const tokens = tokenize(q);
  return tokens.length ? tokens.map((t) => `"${t}"`).join(' ') : null;
}

const SOURCE_PRIORITY_SQL = `CASE f.data_source_id WHEN 'user' THEN 0 WHEN 'user_correction' THEN 0 WHEN 'tcac' THEN 1
  WHEN 'usda_fdc' THEN 2 WHEN 'usda_fndds' THEN 3 WHEN 'off' THEN 4 ELSE 5 END`;

interface SearchRow {
  id: string;
  name_es: string;
  name_en: string | null;
  category: FoodCategory;
  preparation_state: FoodRow['preparationState'];
  product_form: FoodRow['productForm'];
  brand: string | null;
  data_source_id: string;
  owner_profile_id: string | null;
  basis: 'g' | 'ml';
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  density_g_per_ml: number | null;
  is_favorite: number;
  has_override: number;
  eff_basis: 'g' | 'ml' | null;
  eff_kcal: number | null;
  eff_protein: number | null;
  eff_carbs: number | null;
  eff_fat: number | null;
  eff_density: number | null;
}

function tableExists(name: string): boolean {
  return Boolean(getDbHandle().sqlite.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(name));
}

/** Favorites and overrides exist from US4; the query degrades gracefully before their tables exist. */
function prefJoins(): { select: string; joins: string } {
  const fav = tableExists('food_favorite');
  const ovr = tableExists('food_override');
  return {
    select: `${fav ? 'CASE WHEN fav.food_id IS NULL THEN 0 ELSE 1 END' : '0'} AS is_favorite,
      ${ovr ? 'CASE WHEN ov.food_id IS NULL THEN 0 ELSE 1 END' : '0'} AS has_override,
      ${ovr ? 'ovv.basis' : 'NULL'} AS eff_basis, ${ovr ? 'ovv.kcal' : 'NULL'} AS eff_kcal,
      ${ovr ? 'ovv.protein_g' : 'NULL'} AS eff_protein, ${ovr ? 'ovv.carbs_g' : 'NULL'} AS eff_carbs,
      ${ovr ? 'ovv.fat_g' : 'NULL'} AS eff_fat, ${ovr ? 'ovv.density_g_per_ml' : 'NULL'} AS eff_density`,
    joins: `${fav ? 'LEFT JOIN food_favorite fav ON fav.food_id = f.id AND fav.profile_id = @profileId' : ''}
      ${ovr ? 'LEFT JOIN food_override ov ON ov.food_id = f.id AND ov.profile_id = @profileId LEFT JOIN food_version ovv ON ovv.id = ov.food_version_id' : ''}`,
  };
}

function toSummary(r: SearchRow): FoodSummary {
  const o = r.has_override === 1 && r.eff_kcal !== null;
  return {
    id: r.id,
    nameEs: r.name_es,
    nameEn: r.name_en,
    category: r.category,
    preparationState: r.preparation_state,
    brand: r.brand,
    productForm: r.product_form,
    basis: o ? r.eff_basis! : r.basis,
    kcalPer100: o ? r.eff_kcal! : r.kcal,
    proteinPer100: o ? r.eff_protein! : r.protein_g,
    carbsPer100: o ? r.eff_carbs! : r.carbs_g,
    fatPer100: o ? r.eff_fat! : r.fat_g,
    densityGPerMl: o ? r.eff_density : r.density_g_per_ml,
    source: o ? 'user_correction' : r.data_source_id,
    isFavorite: r.is_favorite === 1,
    isCustom: r.owner_profile_id !== null,
    hasOverride: r.has_override === 1,
  };
}

export function searchFoods(profileId: string, params: SearchParams): { items: FoodSummary[]; suggestCustomFood: boolean } {
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);
  const match = params.q ? ftsQuery(params.q) : null;
  const exact = params.q ? ftsExactQuery(params.q) : null;
  const starts = params.q ? ftsStartsQuery(params.q) : null;
  const { select, joins } = prefJoins();
  const where: string[] = ['f.hidden_at IS NULL', '(f.owner_profile_id IS NULL OR f.owner_profile_id = @profileId)'];
  if (match) where.push('food_search MATCH @match');
  if (params.category) where.push('f.category = @category');
  if (params.state) where.push('f.preparation_state = @state');
  if (params.branded !== undefined) where.push(params.branded ? 'f.brand IS NOT NULL' : 'f.brand IS NULL');
  const sqlText = `
    SELECT f.id, f.name_es, f.name_en, f.category, f.preparation_state, f.product_form, f.brand, f.data_source_id, f.owner_profile_id,
      v.basis, v.kcal, v.protein_g, v.carbs_g, v.fat_g, v.density_g_per_ml, ${select},
      ${match ? 'CASE WHEN f.id IN (SELECT food_id FROM food_search WHERE food_search MATCH @exact) THEN 0 ELSE 1 END' : '0'} AS prefix_only,
      ${match ? 'CASE WHEN f.id IN (SELECT food_id FROM food_search WHERE food_search MATCH @starts) THEN 0 ELSE 1 END' : '0'} AS not_starting
    FROM ${match ? 'food_search JOIN food f ON f.id = food_search.food_id' : 'food f'}
    JOIN food_version v ON v.id = f.current_version_id
    ${joins}
    WHERE ${where.join(' AND ')}
    ORDER BY is_favorite DESC, has_override DESC, prefix_only, not_starting, ${match ? 'bm25(food_search, 0, 10, 2, 4, 1),' : ''} ${SOURCE_PRIORITY_SQL}, f.name_es
    LIMIT @limit`;
  const rows = getDbHandle()
    .sqlite.prepare(sqlText)
    .all({ profileId, match, exact, starts, category: params.category, state: params.state, limit }) as SearchRow[];
  const items = rows.map(toSummary);
  return { items, suggestCustomFood: Boolean(params.q?.trim()) && items.length === 0 };
}

/** A food visible to the profile (global or own custom), or NOT_FOUND. */
export function visibleFood(profileId: string, foodId: string): FoodRow {
  const row = db()
    .select()
    .from(food)
    .where(and(eq(food.id, foodId), or(isNull(food.ownerProfileId), eq(food.ownerProfileId, profileId))))
    .get();
  if (!row) throw notFound('Alimento no encontrado.');
  return row;
}

/** Version used for new entries: the profile's correction if any (US4), else the current catalog version. */
export function effectiveVersion(profileId: string, foodRow: FoodRow): { version: FoodVersionRow; isOverride: boolean } {
  if (tableExists('food_override')) {
    const ov = getDbHandle()
      .sqlite.prepare('SELECT food_version_id AS id FROM food_override WHERE profile_id = ? AND food_id = ?')
      .get(profileId, foodRow.id) as { id: string } | undefined;
    if (ov) {
      const v = db().select().from(foodVersion).where(eq(foodVersion.id, ov.id)).get();
      if (v) return { version: v, isOverride: true };
    }
  }
  const v = db().select().from(foodVersion).where(eq(foodVersion.id, foodRow.currentVersionId!)).get();
  if (!v) throw notFound('Alimento sin valores nutricionales.');
  return { version: v, isOverride: false };
}

export function getFood(profileId: string, foodId: string) {
  const f = visibleFood(profileId, foodId);
  const { version, isOverride } = effectiveVersion(profileId, f);
  const src = db().select().from(dataSource).where(eq(dataSource.id, version.dataSourceId)).get();
  const aliases = db().select({ alias: foodAlias.alias, lang: foodAlias.lang }).from(foodAlias).where(eq(foodAlias.foodId, f.id)).all();
  const isFavorite =
    tableExists('food_favorite') &&
    Boolean(getDbHandle().sqlite.prepare('SELECT 1 FROM food_favorite WHERE profile_id = ? AND food_id = ?').get(profileId, f.id));
  return {
    id: f.id,
    nameEs: f.nameEs,
    nameEn: f.nameEn,
    aliases,
    category: f.category,
    preparationState: f.preparationState,
    brand: f.brand,
    productForm: f.productForm,
    preparationInstructions: f.preparationInstructions,
    isCustom: f.ownerProfileId !== null,
    isFavorite,
    hasOverride: isOverride,
    hidden: f.hiddenAt !== null,
    sourceNote: f.sourceNote,
    sourceFoodId: f.sourceFoodId,
    per100: {
      basis: version.basis,
      kcal: version.kcal,
      proteinG: version.proteinG,
      carbsG: version.carbsG,
      fatG: version.fatG,
      fiberG: version.fiberG,
      sugarG: version.sugarG,
      sodiumMg: version.sodiumMg,
      densityGPerMl: version.densityGPerMl,
    },
    versionId: version.id,
    versionNo: version.versionNo,
    source: { id: version.dataSourceId, name: src?.name ?? version.dataSourceId, attribution: src?.attributionText ?? '', license: src?.license ?? '' },
    sourceVersion: version.sourceVersion,
    updatedAt: f.updatedAt,
  };
}

export function listSources() {
  return db().select().from(dataSource).all();
}

/** Other variants (e.g. raw vs cooked) sharing the same base name, for quick switching in the UI. */
export function siblingVariants(profileId: string, foodId: string): FoodSummary[] {
  const f = visibleFood(profileId, foodId);
  const base = f.nameEs.split(',')[0]!.trim();
  if (base.length < 3) return [];
  return searchFoods(profileId, { q: base, limit: 12 }).items.filter((x) => x.id !== f.id && x.nameEs.startsWith(base));
}
