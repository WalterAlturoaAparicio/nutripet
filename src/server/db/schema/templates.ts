import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { profile } from './profiles';
import { food } from './foods';
import { recipe } from './recipes';
import { PORTION_MODES } from './journal';

export const mealTemplate = sqliteTable(
  'meal_template',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profile.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('meal_template_profile_idx').on(t.profileId)],
);

/** A food (food_id + quantity/unit) or a recipe portion (recipe_id + portion_mode [+ servings or quantity/unit]). */
export const mealTemplateItem = sqliteTable('meal_template_item', {
  templateId: text('template_id')
    .notNull()
    .references(() => mealTemplate.id, { onDelete: 'cascade' }),
  foodId: text('food_id').references(() => food.id),
  recipeId: text('recipe_id').references(() => recipe.id),
  portionMode: text('portion_mode', { enum: PORTION_MODES }),
  portionServings: real('portion_servings'),
  quantity: real('quantity'),
  unit: text('unit', { enum: ['g', 'ml'] }),
  position: integer('position').notNull(),
});
