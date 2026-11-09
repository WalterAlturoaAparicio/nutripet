/**
 * Day states, completion and streaks (FR-060–FR-064). Nothing here reads calories or targets (FR-062).
 */
import { BACKFILL_WINDOW_DAYS, FOOD_COMPLETED_MIN_OCCASIONS, FREEZE_EVERY_COMPLETED_DAYS, MAX_FREEZES } from '../config';
import { addDays, dateRange, isoLocalDate, monthDays } from '../dates';
import type { DayStatus, LocalDate } from '../types';

export function foodCompleted(i: { occasionsWithEntries: number; markedComplete: boolean; foodEntryCount: number }): boolean {
  return i.occasionsWithEntries >= FOOD_COMPLETED_MIN_OCCASIONS || (i.markedComplete && i.foodEntryCount >= 1);
}

export interface DayInputs {
  foodEntryCount: number;
  occasionsWithEntries: number;
  markedComplete: boolean;
  activityCount: number;
  restDay: boolean;
}

/** Exactly one of six states. Weight records do not affect it. */
export function dayStatus(i: DayInputs): DayStatus {
  if (i.foodEntryCount === 0) return i.activityCount > 0 ? 'activity_only' : 'none';
  if (!foodCompleted(i)) return 'food_partial';
  if (i.activityCount > 0) return 'full_completed';
  return i.restDay ? 'rest_completed' : 'food_completed';
}

export function isCompleted(status: DayStatus): boolean {
  return status === 'food_completed' || status === 'full_completed' || status === 'rest_completed';
}

export function isRecorded(status: DayStatus): boolean {
  return status !== 'none';
}

/** A completed day earns freezes and streak rewards only if it became completed within the backfill window. */
export function rewardEligible(date: LocalDate, firstCompletedAt: string | null, timeZone: string, windowDays = BACKFILL_WINDOW_DAYS): boolean {
  if (!firstCompletedAt) return false;
  return isoLocalDate(new Date(firstCompletedAt), timeZone) <= addDays(date, windowDays);
}

export interface StreakDay {
  date: LocalDate;
  status: DayStatus;
  rewardEligible: boolean;
}

export interface StreakResult {
  current: number;
  longest: number;
  totalRecordedDays: number;
  totalCompletedDays: number;
  eligibleCompletedDays: number;
  freezesAvailable: number;
  frozenDates: LocalDate[];
  /** Streak length reached on each completed date (for milestone evaluation). */
  streakOn: Record<LocalDate, number>;
}

/**
 * Walks every date from the first recorded day to today. Completed days extend the streak; every 7
 * reward-eligible completed days (cumulative) earn a freeze (max 2). A missed day inside an active
 * streak consumes one freeze if owned (the streak continues without growing), else resets it.
 * An unfinished today neither breaks the streak nor consumes a freeze.
 */
export function computeStreaks(days: StreakDay[], today: LocalDate): StreakResult {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const recorded = days.filter((d) => isRecorded(d.status) && d.date <= today).map((d) => d.date).sort();
  const result: StreakResult = {
    current: 0,
    longest: 0,
    totalRecordedDays: recorded.length,
    totalCompletedDays: 0,
    eligibleCompletedDays: 0,
    freezesAvailable: 0,
    frozenDates: [],
    streakOn: {},
  };
  if (recorded.length === 0) return result;
  for (const date of dateRange(recorded[0]!, today)) {
    const d = byDate.get(date);
    if (d && isCompleted(d.status)) {
      result.current += 1;
      result.longest = Math.max(result.longest, result.current);
      result.totalCompletedDays += 1;
      result.streakOn[date] = result.current;
      if (d.rewardEligible) {
        result.eligibleCompletedDays += 1;
        if (result.eligibleCompletedDays % FREEZE_EVERY_COMPLETED_DAYS === 0) {
          result.freezesAvailable = Math.min(MAX_FREEZES, result.freezesAvailable + 1);
        }
      }
      continue;
    }
    if (date === today) break;
    if (result.current > 0 && result.freezesAvailable > 0) {
      result.freezesAvailable -= 1;
      result.frozenDates.push(date);
    } else {
      result.current = 0;
    }
  }
  return result;
}

/** Completed days ÷ elapsed days of the month (from `startDate` if later); today counts only once completed. */
export function monthCompletionPct(days: StreakDay[], month: string, today: LocalDate, startDate?: LocalDate): number {
  const completed = new Set(days.filter((d) => isCompleted(d.status)).map((d) => d.date));
  const elapsed = monthDays(month).filter((d) => d <= today && (!startDate || d >= startDate) && (d < today || completed.has(d)));
  if (elapsed.length === 0) return 0;
  return Math.round((elapsed.filter((d) => completed.has(d)).length / elapsed.length) * 100);
}
