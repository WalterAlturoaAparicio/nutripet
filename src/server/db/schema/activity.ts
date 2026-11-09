import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { profile } from './profiles';

/** Built-in (owner null) or custom activity types with MET values per intensity (FR-041). */
export const activityType = sqliteTable(
  'activity_type',
  {
    id: text('id').primaryKey(),
    ownerProfileId: text('owner_profile_id').references(() => profile.id, { onDelete: 'cascade' }),
    nameEs: text('name_es').notNull(),
    icon: text('icon'),
    metLight: real('met_light'),
    metModerate: real('met_moderate'),
    metVigorous: real('met_vigorous'),
    compendiumCode: text('compendium_code'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('activity_type_owner_idx').on(t.ownerProfileId)],
);

export const activityEntry = sqliteTable(
  'activity_entry',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profile.id, { onDelete: 'cascade' }),
    activityTypeId: text('activity_type_id')
      .notNull()
      .references(() => activityType.id),
    snapName: text('snap_name').notNull(),
    localDate: text('local_date').notNull(),
    durationMin: integer('duration_min').notNull(),
    intensity: text('intensity', { enum: ['light', 'moderate', 'vigorous'] }),
    estimateMethod: text('estimate_method', { enum: ['met', 'manual', 'none'] }).notNull(),
    metUsed: real('met_used'),
    weightKgUsed: real('weight_kg_used'),
    netKcal: real('net_kcal').notNull(),
    note: text('note'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('activity_entry_profile_date_idx').on(t.profileId, t.localDate)],
);
