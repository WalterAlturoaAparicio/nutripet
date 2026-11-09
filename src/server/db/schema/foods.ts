import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { profile } from './profiles';

export const FOOD_CATEGORIES = [
  'cereales',
  'carnes',
  'pescados',
  'huevos',
  'lacteos',
  'leguminosas',
  'tuberculos_platanos',
  'frutas',
  'verduras',
  'grasas',
  'azucares',
  'bebidas',
  'preparaciones',
  'empacados',
  'otros',
] as const;
export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const DATA_SOURCE_IDS = ['usda_fdc', 'usda_fndds', 'tcac', 'off', 'reference', 'user', 'user_correction'] as const;
export type DataSourceId = (typeof DATA_SOURCE_IDS)[number];

/**
 * Physical form the nutrition values refer to (FR-048). `as_sold` = ready to eat/drink as stored;
 * `dry_mix` (e.g. lemonade or chocolate powder) and `concentrate` are values for the product
 * BEFORE preparation and never describe the prepared beverage.
 */
export const PRODUCT_FORMS = ['as_sold', 'dry_mix', 'concentrate'] as const;
export type ProductForm = (typeof PRODUCT_FORMS)[number];

export const dataSource = sqliteTable('data_source', {
  id: text('id', { enum: DATA_SOURCE_IDS }).primaryKey(),
  name: text('name').notNull(),
  license: text('license').notNull(),
  attributionText: text('attribution_text').notNull(),
  url: text('url'),
});

export const importRun = sqliteTable('import_run', {
  id: text('id').primaryKey(),
  dataSourceId: text('data_source_id', { enum: DATA_SOURCE_IDS })
    .notNull()
    .references(() => dataSource.id),
  sourceVersion: text('source_version').notNull(),
  inputChecksum: text('input_checksum').notNull(),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  status: text('status', { enum: ['running', 'ok', 'failed'] }).notNull(),
  created: integer('created').notNull().default(0),
  updated: integer('updated').notNull().default(0),
  unchanged: integer('unchanged').notNull().default(0),
  skipped: integer('skipped').notNull().default(0),
  reportPath: text('report_path'),
});

/** Stable food identity. Nutrition values live in immutable food_version rows. */
export const food = sqliteTable(
  'food',
  {
    id: text('id').primaryKey(),
    dataSourceId: text('data_source_id', { enum: DATA_SOURCE_IDS })
      .notNull()
      .references(() => dataSource.id),
    sourceFoodId: text('source_food_id'),
    ownerProfileId: text('owner_profile_id').references(() => profile.id, { onDelete: 'cascade' }),
    nameEs: text('name_es').notNull(),
    nameEn: text('name_en'),
    category: text('category', { enum: FOOD_CATEGORIES }).notNull(),
    preparationState: text('preparation_state', { enum: ['raw', 'cooked', 'prepared', 'packaged'] }).notNull(),
    brand: text('brand'),
    productForm: text('product_form', { enum: PRODUCT_FORMS }).notNull().default('as_sold'),
    preparationInstructions: text('preparation_instructions'),
    currentVersionId: text('current_version_id'),
    sourceNote: text('source_note'),
    hiddenAt: text('hidden_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('food_source_unique').on(t.dataSourceId, t.sourceFoodId),
    index('food_owner_idx').on(t.ownerProfileId),
  ],
);

export const foodAlias = sqliteTable(
  'food_alias',
  {
    foodId: text('food_id')
      .notNull()
      .references(() => food.id, { onDelete: 'cascade' }),
    alias: text('alias').notNull(),
    lang: text('lang', { enum: ['es', 'en'] }).notNull(),
  },
  (t) => [uniqueIndex('food_alias_unique').on(t.foodId, t.alias, t.lang)],
);

/** Immutable nutrition values per 100 g or 100 ml (FR-020, FR-033). Never updated or deleted. */
export const foodVersion = sqliteTable(
  'food_version',
  {
    id: text('id').primaryKey(),
    foodId: text('food_id')
      .notNull()
      .references(() => food.id),
    versionNo: integer('version_no').notNull(),
    basis: text('basis', { enum: ['g', 'ml'] }).notNull(),
    kcal: real('kcal').notNull(),
    proteinG: real('protein_g').notNull(),
    carbsG: real('carbs_g').notNull(),
    fatG: real('fat_g').notNull(),
    fiberG: real('fiber_g'),
    sugarG: real('sugar_g'),
    sodiumMg: real('sodium_mg'),
    densityGPerMl: real('density_g_per_ml'),
    dataSourceId: text('data_source_id', { enum: DATA_SOURCE_IDS })
      .notNull()
      .references(() => dataSource.id),
    sourceVersion: text('source_version').notNull(),
    importRunId: text('import_run_id').references(() => importRun.id),
    createdAt: text('created_at').notNull(),
  },
  (t) => [uniqueIndex('food_version_unique').on(t.foodId, t.versionNo)],
);
