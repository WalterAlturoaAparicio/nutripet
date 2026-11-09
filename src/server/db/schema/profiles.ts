import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const profile = sqliteTable(
  'profile',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    targetWeightKg: real('target_weight_kg').notNull(),
    weightUnit: text('weight_unit', { enum: ['kg', 'lb'] }).notNull().default('kg'),
    heightUnit: text('height_unit', { enum: ['cm', 'ft_in'] }).notNull().default('cm'),
    foodUnit: text('food_unit', { enum: ['metric', 'imperial'] }).notNull().default('metric'),
    timeZone: text('time_zone').notNull().default('America/Bogota'),
    pinHash: text('pin_hash').notNull(),
    recoveryCodeHash: text('recovery_code_hash').notNull(),
    failedPinAttempts: integer('failed_pin_attempts').notNull().default(0),
    pinLockSeries: integer('pin_lock_series').notNull().default(0),
    lockedUntil: text('locked_until'),
    failedRecoveryAttempts: integer('failed_recovery_attempts').notNull().default(0),
    recoveryLockSeries: integer('recovery_lock_series').notNull().default(0),
    recoveryLockedUntil: text('recovery_locked_until'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('profile_name_unique').on(sql`lower(${t.name})`)],
);

export const session = sqliteTable(
  'session',
  {
    tokenHash: text('token_hash').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profile.id, { onDelete: 'cascade' }),
    lastSeenAt: text('last_seen_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('session_profile_idx').on(t.profileId)],
);

export const weightRecord = sqliteTable(
  'weight_record',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profile.id, { onDelete: 'cascade' }),
    localDate: text('local_date').notNull(),
    weightKg: real('weight_kg').notNull(),
    note: text('note'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('weight_profile_date_idx').on(t.profileId, t.localDate)],
);
