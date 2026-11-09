import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { profile } from './profiles';
import { food, foodVersion } from './foods';
import { recipe, recipeVersion } from './recipes';

export const PORTION_MODES = ['whole', 'servings', 'amount'] as const;

export const OCCASION_VALUES = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'extra'] as const;

export const meal = sqliteTable(
  'meal',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profile.id, { onDelete: 'cascade' }),
    localDate: text('local_date').notNull(),
    occasion: text('occasion', { enum: OCCASION_VALUES }).notNull(),
    label: text('label'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('meal_unique_occasion').on(t.profileId, t.localDate, t.occasion).where(sql`occasion <> 'extra'`),
    index('meal_profile_date_idx').on(t.profileId, t.localDate),
  ],
);

/**
 * A logged item with a frozen copy of the values used at logging time (FR-033).
 * kind = 'food': a catalog/custom food; quantity, unit and the per-100 snapshot are always set.
 * kind = 'recipe': a portion of a saved preparation version (FR-045). Nutrients are
 * recipe_version totals × portion_factor; quantity/unit hold the consumed amount when it is known
 * and the per-100 snapshot holds values per 100 of the final yield when the yield is known.
 */
export const mealEntry = sqliteTable(
  'meal_entry',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profile.id, { onDelete: 'cascade' }),
    mealId: text('meal_id')
      .notNull()
      .references(() => meal.id, { onDelete: 'cascade' }),
    localDate: text('local_date').notNull(),
    kind: text('kind', { enum: ['food', 'recipe'] }).notNull().default('food'),
    foodId: text('food_id').references(() => food.id),
    foodVersionId: text('food_version_id').references(() => foodVersion.id),
    recipeId: text('recipe_id').references(() => recipe.id),
    recipeVersionId: text('recipe_version_id').references(() => recipeVersion.id),
    portionMode: text('portion_mode', { enum: PORTION_MODES }),
    portionServings: real('portion_servings'),
    portionFactor: real('portion_factor'),
    quantity: real('quantity'),
    unit: text('unit', { enum: ['g', 'ml'] }),
    approximate: integer('approximate', { mode: 'boolean' }).notNull(),
    eatenAt: text('eaten_at').notNull(),
    note: text('note'),
    snapName: text('snap_name').notNull(),
    snapBrand: text('snap_brand'),
    snapPreparationState: text('snap_preparation_state', { enum: ['raw', 'cooked', 'prepared', 'packaged'] }).notNull(),
    snapDataSourceId: text('snap_data_source_id').notNull(),
    snapSourceVersion: text('snap_source_version').notNull(),
    snapProductForm: text('snap_product_form', { enum: ['as_sold', 'dry_mix', 'concentrate'] }).notNull().default('as_sold'),
    snapBasis: text('snap_basis', { enum: ['g', 'ml'] }),
    snapDensityGPerMl: real('snap_density_g_per_ml'),
    snapKcalPer100: real('snap_kcal_per100'),
    snapProteinPer100: real('snap_protein_per100'),
    snapCarbsPer100: real('snap_carbs_per100'),
    snapFatPer100: real('snap_fat_per100'),
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
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('meal_entry_profile_date_idx').on(t.profileId, t.localDate),
    index('meal_entry_meal_idx').on(t.mealId),
    index('meal_entry_food_idx').on(t.profileId, t.foodId),
    index('meal_entry_recipe_idx').on(t.profileId, t.recipeId),
  ],
);
