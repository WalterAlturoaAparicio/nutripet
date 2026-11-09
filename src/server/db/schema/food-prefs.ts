import { primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { profile } from './profiles';
import { food, foodVersion } from './foods';

/** A profile's own correction of a catalog food (FR-026). Other profiles keep the catalog values. */
export const foodOverride = sqliteTable(
  'food_override',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profile.id, { onDelete: 'cascade' }),
    foodId: text('food_id')
      .notNull()
      .references(() => food.id),
    foodVersionId: text('food_version_id')
      .notNull()
      .references(() => foodVersion.id),
    createdAt: text('created_at').notNull(),
  },
  (t) => [uniqueIndex('food_override_unique').on(t.profileId, t.foodId)],
);

export const foodFavorite = sqliteTable(
  'food_favorite',
  {
    profileId: text('profile_id')
      .notNull()
      .references(() => profile.id, { onDelete: 'cascade' }),
    foodId: text('food_id')
      .notNull()
      .references(() => food.id),
    createdAt: text('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.foodId] })],
);
