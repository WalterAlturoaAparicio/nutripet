import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { profile } from './profiles';

/** Devices allowed to see the profile selector (FR-008). Not owned by a profile. */
export const device = sqliteTable(
  'device',
  {
    id: text('id').primaryKey(),
    tokenHash: text('token_hash').notNull().unique(),
    label: text('label').notNull(),
    enrolledVia: text('enrolled_via', { enum: ['initial_setup', 'setup_token', 'pairing_code'] }).notNull(),
    enrolledByProfileId: text('enrolled_by_profile_id').references(() => profile.id, { onDelete: 'set null' }),
    createdAt: text('created_at').notNull(),
    lastSeenAt: text('last_seen_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    revokedAt: text('revoked_at'),
  },
  (t) => [index('device_token_idx').on(t.tokenHash)],
);

export const pairingCode = sqliteTable('pairing_code', {
  codeHash: text('code_hash').primaryKey(),
  issuedByProfileId: text('issued_by_profile_id')
    .notNull()
    .references(() => profile.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at'),
  createdAt: text('created_at').notNull(),
});
