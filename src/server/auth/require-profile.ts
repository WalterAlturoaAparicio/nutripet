import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { profile } from '../db/schema';
import { ApiError } from '../http/errors';
import type { Ctx } from '../http/handler';
import { readSession } from './session';

export type ProfileRow = typeof profile.$inferSelect;

/** The ONLY way handlers obtain a profileId: from the session cookie, never from the request. */
export function requireProfile(ctx: Ctx): { profileId: string; profile: ProfileRow } {
  const profileId = readSession(ctx);
  if (!profileId) throw new ApiError('UNAUTHENTICATED');
  const row = db().select().from(profile).where(eq(profile.id, profileId)).get();
  if (!row) throw new ApiError('UNAUTHENTICATED');
  return { profileId, profile: row };
}

export function optionalProfile(ctx: Ctx): string | null {
  return readSession(ctx);
}
