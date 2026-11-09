/**
 * Calendar, day states and streaks (FR-060–FR-065). Recomputed from the records after every tracking
 * change, so backfills and deletions are always reflected.
 */
import { and, eq } from 'drizzle-orm';
import { isoLocalDate, monthDays } from '@/domain/dates';
import { computeStreaks, dayStatus, isCompleted, monthCompletionPct, rewardEligible, type DayInputs, type StreakDay, type StreakResult } from '@/domain/tracking';
import type { DayStatus, LocalDate } from '@/domain/types';
import { db, getDbHandle } from '../../db/client';
import { dayLog, profile, streakCache } from '../../db/schema';
import { nowIso } from '../../clock';
import { assertNotFuture, profileTimeZone, profileToday } from '../profiles/time';
import { emitTracking } from '../events';

export interface DayRow extends DayInputs {
  date: LocalDate;
  firstCompletedAt: string | null;
}

/** Aggregated inputs per date (only dates with any record or flag). */
export function dayInputs(profileId: string, from = '0000-01-01', to = '9999-12-31'): Map<LocalDate, DayRow> {
  const rows = getDbHandle()
    .sqlite.prepare(
      `WITH dates AS (
         SELECT local_date FROM meal_entry WHERE profile_id = @p AND local_date BETWEEN @from AND @to
         UNION SELECT local_date FROM activity_entry WHERE profile_id = @p AND local_date BETWEEN @from AND @to
         UNION SELECT local_date FROM day_log WHERE profile_id = @p AND local_date BETWEEN @from AND @to
       )
       SELECT d.local_date AS date,
         (SELECT count(*) FROM meal_entry e WHERE e.profile_id = @p AND e.local_date = d.local_date) AS foodEntryCount,
         (SELECT count(DISTINCT m.occasion || coalesce(m.label, '')) FROM meal m
            WHERE m.profile_id = @p AND m.local_date = d.local_date
              AND EXISTS (SELECT 1 FROM meal_entry e WHERE e.meal_id = m.id)) AS occasionsWithEntries,
         (SELECT count(*) FROM activity_entry a WHERE a.profile_id = @p AND a.local_date = d.local_date) AS activityCount,
         coalesce(l.rest_day, 0) AS restDay, coalesce(l.marked_complete, 0) AS markedComplete, l.first_completed_at AS firstCompletedAt
       FROM dates d LEFT JOIN day_log l ON l.profile_id = @p AND l.local_date = d.local_date`,
    )
    .all({ p: profileId, from, to }) as (Omit<DayRow, 'restDay' | 'markedComplete'> & { restDay: number; markedComplete: number })[];
  return new Map(rows.map((r) => [r.date, { ...r, restDay: r.restDay === 1, markedComplete: r.markedComplete === 1 }]));
}

const EMPTY: DayInputs = { foodEntryCount: 0, occasionsWithEntries: 0, markedComplete: false, activityCount: 0, restDay: false };

export function statusFor(profileId: string, date: LocalDate): { status: DayStatus; row: DayRow | undefined } {
  const row = dayInputs(profileId, date, date).get(date);
  return { status: dayStatus(row ?? EMPTY), row };
}

/** Maintains first_completed_at on entering/leaving a completed state. Returns the previous and new status. */
export function updateDayCompletion(profileId: string, date: LocalDate): { before: boolean; after: DayStatus; firstCompletedAt: string | null } {
  const { status, row } = statusFor(profileId, date);
  const completed = isCompleted(status);
  const had = Boolean(row?.firstCompletedAt);
  let first = row?.firstCompletedAt ?? null;
  if (completed && !had) {
    first = nowIso();
    db()
      .insert(dayLog)
      .values({ profileId, localDate: date, firstCompletedAt: first })
      .onConflictDoUpdate({ target: [dayLog.profileId, dayLog.localDate], set: { firstCompletedAt: first } })
      .run();
  } else if (!completed && had) {
    first = null;
    db().update(dayLog).set({ firstCompletedAt: null }).where(and(eq(dayLog.profileId, profileId), eq(dayLog.localDate, date))).run();
  }
  return { before: had, after: status, firstCompletedAt: first };
}

export function setDayFlags(profileId: string, date: LocalDate, flags: { restDay?: boolean; markedComplete?: boolean }): void {
  assertNotFuture(profileId, date);
  db()
    .insert(dayLog)
    .values({ profileId, localDate: date, restDay: flags.restDay ?? false, markedComplete: flags.markedComplete ?? false })
    .onConflictDoUpdate({ target: [dayLog.profileId, dayLog.localDate], set: { ...flags } })
    .run();
  emitTracking({ profileId, date, kind: 'day_flags', recordId: `day:${date}`, action: 'updated' });
}

export function dayFlags(profileId: string, date: LocalDate): { restDay: boolean; markedComplete: boolean } {
  const r = db().select().from(dayLog).where(and(eq(dayLog.profileId, profileId), eq(dayLog.localDate, date))).get();
  return { restDay: r?.restDay ?? false, markedComplete: r?.markedComplete ?? false };
}

export function streakDays(profileId: string): StreakDay[] {
  const tz = profileTimeZone(profileId);
  return [...dayInputs(profileId).values()].map((r) => {
    const status = dayStatus(r);
    return { date: r.date, status, rewardEligible: isCompleted(status) && rewardEligible(r.date, r.firstCompletedAt, tz) };
  });
}

/** Full recompute from the first recorded date; cached in streak_cache. */
export function recomputeStreak(profileId: string): StreakResult {
  const today = profileToday(profileId);
  const r = computeStreaks(streakDays(profileId), today);
  const values = {
    current: r.current,
    longest: r.longest,
    totalRecordedDays: r.totalRecordedDays,
    totalCompletedDays: r.totalCompletedDays,
    eligibleCompletedDays: r.eligibleCompletedDays,
    freezesAvailable: r.freezesAvailable,
    computedThroughDate: today,
  };
  db().insert(streakCache).values({ profileId, ...values }).onConflictDoUpdate({ target: streakCache.profileId, set: values }).run();
  return r;
}

export function getCalendar(profileId: string, month: string) {
  const days = streakDays(profileId);
  const streak = recomputeStreak(profileId);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const inputs = dayInputs(profileId, `${month}-01`, `${month}-31`);
  const frozen = new Set(streak.frozenDates);
  const created = db().select({ c: profile.createdAt, tz: profile.timeZone }).from(profile).where(eq(profile.id, profileId)).get()!;
  const startDate = isoLocalDate(new Date(created.c), created.tz);
  return {
    month,
    days: monthDays(month).map((date) => {
      const d = byDate.get(date);
      return {
        date,
        status: d?.status ?? 'none',
        frozen: frozen.has(date),
        hasActivity: (inputs.get(date)?.activityCount ?? 0) > 0,
        rewardEligible: d?.rewardEligible ?? false,
      };
    }),
    streak: {
      current: streak.current,
      longest: streak.longest,
      totalRecordedDays: streak.totalRecordedDays,
      totalCompletedDays: streak.totalCompletedDays,
      freezesAvailable: streak.freezesAvailable,
    },
    monthCompletionPct: monthCompletionPct(days, month, profileToday(profileId), startDate),
  };
}

export function streakSummary(profileId: string) {
  const r = recomputeStreak(profileId);
  return { current: r.current, longest: r.longest, freezesAvailable: r.freezesAvailable, totalCompletedDays: r.totalCompletedDays };
}
