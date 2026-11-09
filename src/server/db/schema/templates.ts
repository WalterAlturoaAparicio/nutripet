import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { profile } from './profiles';
import { food } from './foods';

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

export const mealTemplateItem = sqliteTable('meal_template_item', {
  templateId: text('template_id')
    .notNull()
    .references(() => mealTemplate.id, { onDelete: 'cascade' }),
  foodId: text('food_id')
    .notNull()
    .references(() => food.id),
  quantity: real('quantity').notNull(),
  unit: text('unit', { enum: ['g', 'ml'] }).notNull(),
  position: integer('position').notNull(),
});
