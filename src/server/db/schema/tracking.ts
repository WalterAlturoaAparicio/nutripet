import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { profile } from './profiles';

/** Per-day flags plus the moment the day first entered a completed state (reward eligibility, U2). */
export const dayLog = sqliteTable(
  'day_log',
  {
    profileId: text('profile_id')
      .notNull()
      .references(() => profile.id, { onDelete: 'cascade' }),
    localDate: text('local_date').notNull(),
    restDay: integer('rest_day', { mode: 'boolean' }).notNull().default(false),
    markedComplete: integer('marked_complete', { mode: 'boolean' }).notNull().default(false),
    firstCompletedAt: text('first_completed_at'),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.localDate] })],
);

export const streakCache = sqliteTable('streak_cache', {
  profileId: text('profile_id')
    .primaryKey()
    .references(() => profile.id, { onDelete: 'cascade' }),
  current: integer('current').notNull(),
  longest: integer('longest').notNull(),
  totalRecordedDays: integer('total_recorded_days').notNull(),
  totalCompletedDays: integer('total_completed_days').notNull(),
  eligibleCompletedDays: integer('eligible_completed_days').notNull(),
  freezesAvailable: integer('freezes_available').notNull(),
  computedThroughDate: text('computed_through_date').notNull(),
});
