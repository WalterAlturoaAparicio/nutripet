import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { profile } from './profiles';
import { food, foodVersion } from './foods';

/**
 * A profile's own preparation (FR-038, FR-049): stable identity. Its composition lives in immutable
 * recipe_version rows, so editing a recipe never changes meals that already used it (FR-046).
 */
export const recipe = sqliteTable(
  'recipe',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profile.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    currentVersionId: text('current_version_id'),
    hiddenAt: text('hidden_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('recipe_profile_idx').on(t.profileId)],
);

/** Immutable composition + calculated totals of one version of a recipe. Never updated or deleted. */
export const recipeVersion = sqliteTable(
  'recipe_version',
  {
    id: text('id').primaryKey(),
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipe.id, { onDelete: 'cascade' }),
    versionNo: integer('version_no').notNull(),
    notes: text('notes'),
    servings: real('servings'),
    /** Actual final mass/volume entered by the user; never derived from the ingredient sum. */
    yieldQuantity: real('yield_quantity'),
    yieldUnit: text('yield_unit', { enum: ['g', 'ml'] }),
    homogeneous: integer('homogeneous', { mode: 'boolean' }).notNull(),
    approximate: integer('approximate', { mode: 'boolean' }).notNull(),
    kcal: real('kcal').notNull(),
    proteinG: real('protein_g').notNull(),
    carbsG: real('carbs_g').notNull(),
    fatG: real('fat_g').notNull(),
    fiberG: real('fiber_g'),
    sugarG: real('sugar_g'),
    sodiumMg: real('sodium_mg'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [uniqueIndex('recipe_version_unique').on(t.recipeId, t.versionNo)],
);

/** An ingredient of a recipe version, with a frozen copy of the food values it was computed from. */
export const recipeIngredient = sqliteTable(
  'recipe_ingredient',
  {
    id: text('id').primaryKey(),
    recipeVersionId: text('recipe_version_id')
      .notNull()
      .references(() => recipeVersion.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    foodId: text('food_id')
      .notNull()
      .references(() => food.id),
    foodVersionId: text('food_version_id')
      .notNull()
      .references(() => foodVersion.id),
    quantity: real('quantity').notNull(),
    unit: text('unit', { enum: ['g', 'ml'] }).notNull(),
    approximate: integer('approximate', { mode: 'boolean' }).notNull(),
    snapName: text('snap_name').notNull(),
    snapBrand: text('snap_brand'),
    snapPreparationState: text('snap_preparation_state', { enum: ['raw', 'cooked', 'prepared', 'packaged'] }).notNull(),
    snapProductForm: text('snap_product_form', { enum: ['as_sold', 'dry_mix', 'concentrate'] }).notNull(),
    snapDataSourceId: text('snap_data_source_id').notNull(),
    snapSourceVersion: text('snap_source_version').notNull(),
    snapBasis: text('snap_basis', { enum: ['g', 'ml'] }).notNull(),
    snapDensityGPerMl: real('snap_density_g_per_ml'),
    snapKcalPer100: real('snap_kcal_per100').notNull(),
    snapProteinPer100: real('snap_protein_per100').notNull(),
    snapCarbsPer100: real('snap_carbs_per100').notNull(),
    snapFatPer100: real('snap_fat_per100').notNull(),
    snapFiberPer100: real('snap_fiber_per100'),
    snapSugarPer100: real('snap_sugar_per100'),
    snapSodiumPer100: real('snap_sodium_per100'),
    kcal: real('kcal').notNull(),
    proteinG: real('protein_g').notNull(),
    carbsG: real('carbs_g').notNull(),
    fatG: real('fat_g').notNull(),
    fiberG: real('fiber_g'),
    sugarG: real('sugar_g'),
    sodiumMg: real('sodium_mg'),
  },
  (t) => [index('recipe_ingredient_version_idx').on(t.recipeVersionId)],
);
