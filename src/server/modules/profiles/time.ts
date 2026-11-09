import { eq } from 'drizzle-orm';
import { isFuture } from '@/domain/dates';
import type { LocalDate } from '@/domain/types';
import { db } from '../../db/client';
import { profile } from '../../db/schema';
import { todayIn } from '../../clock';
import { ApiError } from '../../http/errors';

export function profileTimeZone(profileId: string): string {
  return db().select({ tz: profile.timeZone }).from(profile).where(eq(profile.id, profileId)).get()?.tz ?? 'America/Bogota';
}

/** Today in the profile's time zone (FR-007). */
export function profileToday(profileId: string): LocalDate {
  return todayIn(profileTimeZone(profileId));
}

export function assertNotFuture(profileId: string, date: LocalDate, field = 'date'): void {
  if (isFuture(date, profileToday(profileId))) {
    throw new ApiError('VALIDATION', 'No puedes registrar días futuros.', { fields: { [field]: 'No puedes registrar días futuros.' } });
  }
}
