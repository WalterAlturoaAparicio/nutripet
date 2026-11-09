/**
 * Escalating lockout for PIN and recovery-code attempts (FR-004, research.md R3).
 *
 * Policy (same for both kinds, separate counters):
 * - every 5th consecutive failure starts a lock: 60 s × 2^(series − 1), capped at 15 min;
 * - the counter restarts after each lock, the series keeps growing until a success;
 * - success resets that kind; a successful recovery resets BOTH kinds.
 */
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { profile } from '../db/schema';
import { now } from '../clock';
import { ApiError } from '../http/errors';
import type { ProfileRow } from './require-profile';

export type LockKind = 'pin' | 'recovery';

export const MAX_ATTEMPTS = 5;
const BASE_LOCK_SEC = 60;
const MAX_LOCK_SEC = 15 * 60;

const COLS = {
  pin: { attempts: 'failedPinAttempts', series: 'pinLockSeries', until: 'lockedUntil' },
  recovery: { attempts: 'failedRecoveryAttempts', series: 'recoveryLockSeries', until: 'recoveryLockedUntil' },
} as const;

export function lockSeconds(series: number): number {
  return Math.min(MAX_LOCK_SEC, BASE_LOCK_SEC * 2 ** (series - 1));
}

/** Throws LOCKED with retryAfterSec while a lock is active. */
export function checkLocked(row: ProfileRow, kind: LockKind): void {
  const until = row[COLS[kind].until];
  if (!until) return;
  const remaining = Math.ceil((Date.parse(until) - now().getTime()) / 1000);
  if (remaining > 0) throw new ApiError('LOCKED', undefined, { retryAfterSec: remaining, reason: kind });
}

/** Records a failure. Returns the lock duration in seconds if this failure started a lock. */
export function registerFailure(row: ProfileRow, kind: LockKind): number | null {
  const c = COLS[kind];
  const attempts = row[c.attempts] + 1;
  if (attempts >= MAX_ATTEMPTS) {
    const series = row[c.series] + 1;
    const sec = lockSeconds(series);
    db()
      .update(profile)
      .set({ [c.attempts]: 0, [c.series]: series, [c.until]: new Date(now().getTime() + sec * 1000).toISOString() })
      .where(eq(profile.id, row.id))
      .run();
    return sec;
  }
  db().update(profile).set({ [c.attempts]: attempts }).where(eq(profile.id, row.id)).run();
  return null;
}

export function registerSuccess(profileId: string, kinds: LockKind[]): void {
  const values: Record<string, number | null> = {};
  for (const k of kinds) {
    values[COLS[k].attempts] = 0;
    values[COLS[k].series] = 0;
    values[COLS[k].until] = null;
  }
  db().update(profile).set(values).where(eq(profile.id, profileId)).run();
}
