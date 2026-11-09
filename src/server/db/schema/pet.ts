import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { profile } from './profiles';

/** One independent cat per profile (FR-070). Stage derives from max_xp_reached and never decreases. */
export const pet = sqliteTable('pet', {
  profileId: text('profile_id')
    .primaryKey()
    .references(() => profile.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  xpTotal: integer('xp_total').notNull().default(0),
  maxXpReached: integer('max_xp_reached').notNull().default(0),
  stage: text('stage', { enum: ['newborn', 'young', 'adolescent', 'adult', 'special'] }).notNull().default('newborn'),
  mood: integer('mood').notNull().default(70),
  moodUpdatedDate: text('mood_updated_date').notNull(),
  treats: integer('treats').notNull().default(0),
  equippedAccessoryIds: text('equipped_accessory_ids').notNull().default('[]'),
  createdAt: text('created_at').notNull(),
});

export const xpEvent = sqliteTable(
  'xp_event',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profile.id, { onDelete: 'cascade' }),
    source: text('source', { enum: ['food_entry', 'food_day', 'activity', 'activity_bonus', 'weight', 'streak', 'milestone'] }).notNull(),
    sourceRecordId: text('source_record_id').notNull(),
    loggedDate: text('logged_date').notNull(),
    amount: integer('amount').notNull(),
    createdAt: text('created_at').notNull(),
    revokedAt: text('revoked_at'),
  },
  (t) => [uniqueIndex('xp_event_unique').on(t.profileId, t.source, t.sourceRecordId), index('xp_event_date_idx').on(t.profileId, t.loggedDate)],
);

export const treatEvent = sqliteTable(
  'treat_event',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profile.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['food_day', 'milestone'] }).notNull(),
    sourceRecordId: text('source_record_id').notNull(),
    loggedDate: text('logged_date').notNull(),
    amount: integer('amount').notNull(),
    createdAt: text('created_at').notNull(),
    revokedAt: text('revoked_at'),
  },
  (t) => [uniqueIndex('treat_event_unique').on(t.profileId, t.kind, t.sourceRecordId)],
);

export const milestone = sqliteTable('milestone', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: ['streak', 'first_full_week', 'stage'] }).notNull(),
  threshold: integer('threshold').notNull(),
  xpReward: integer('xp_reward').notNull(),
  treatReward: integer('treat_reward').notNull(),
  accessoryId: text('accessory_id'),
});

export const milestoneUnlock = sqliteTable(
  'milestone_unlock',
  {
    profileId: text('profile_id')
      .notNull()
      .references(() => profile.id, { onDelete: 'cascade' }),
    milestoneId: text('milestone_id')
      .notNull()
      .references(() => milestone.id),
    unlockedAt: text('unlocked_at').notNull(),
    loggedDate: text('logged_date').notNull(),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.milestoneId] })],
);

export const accessory = sqliteTable('accessory', {
  id: text('id').primaryKey(),
  nameEs: text('name_es').notNull(),
});

export const petAccessoryUnlock = sqliteTable(
  'pet_accessory_unlock',
  {
    profileId: text('profile_id')
      .notNull()
      .references(() => profile.id, { onDelete: 'cascade' }),
    accessoryId: text('accessory_id')
      .notNull()
      .references(() => accessory.id),
    unlockedAt: text('unlocked_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.accessoryId] })],
);
