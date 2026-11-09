import { describe, expect, it } from 'vitest';
import { addDays, dateRange } from '@/domain/dates';
import { computeStreaks, dayStatus, foodCompleted, isCompleted, monthCompletionPct, rewardEligible, type StreakDay } from '@/domain/tracking';
import type { DayStatus } from '@/domain/types';

describe('foodCompleted (FR-061)', () => {
  it('3 occasions, or 2 + marked complete; marking with no food does not count', () => {
    expect(foodCompleted({ occasionsWithEntries: 3, markedComplete: false, foodEntryCount: 3 })).toBe(true);
    expect(foodCompleted({ occasionsWithEntries: 2, markedComplete: true, foodEntryCount: 4 })).toBe(true);
    expect(foodCompleted({ occasionsWithEntries: 2, markedComplete: false, foodEntryCount: 4 })).toBe(false);
    expect(foodCompleted({ occasionsWithEntries: 0, markedComplete: true, foodEntryCount: 0 })).toBe(false);
  });
});

describe('dayStatus (FR-060)', () => {
  const s = (o: Partial<Parameters<typeof dayStatus>[0]>) =>
    dayStatus({ foodEntryCount: 0, occasionsWithEntries: 0, markedComplete: false, activityCount: 0, restDay: false, ...o });
  it('covers all six states', () => {
    expect(s({})).toBe('none');
    expect(s({ activityCount: 1 })).toBe('activity_only');
    expect(s({ activityCount: 1, restDay: true })).toBe('activity_only');
    expect(s({ foodEntryCount: 2, occasionsWithEntries: 2 })).toBe('food_partial');
    expect(s({ foodEntryCount: 2, occasionsWithEntries: 2, activityCount: 1 })).toBe('food_partial');
    expect(s({ foodEntryCount: 3, occasionsWithEntries: 3 })).toBe('food_completed');
    expect(s({ foodEntryCount: 3, occasionsWithEntries: 3, activityCount: 1 })).toBe('full_completed');
    expect(s({ foodEntryCount: 3, occasionsWithEntries: 3, activityCount: 1, restDay: true })).toBe('full_completed');
    expect(s({ foodEntryCount: 3, occasionsWithEntries: 3, restDay: true })).toBe('rest_completed');
    expect(s({ foodEntryCount: 1, occasionsWithEntries: 1, markedComplete: true })).toBe('food_completed');
  });
  it('isCompleted', () => {
    const done: DayStatus[] = ['food_completed', 'full_completed', 'rest_completed'];
    const notDone: DayStatus[] = ['none', 'activity_only', 'food_partial'];
    for (const d of done) expect(isCompleted(d)).toBe(true);
    for (const d of notDone) expect(isCompleted(d)).toBe(false);
  });
});

describe('rewardEligible (U2)', () => {
  it('completed within the 2-day window in the profile time zone', () => {
    expect(rewardEligible('2026-11-08', '2026-11-08T20:00:00Z', 'America/Bogota')).toBe(true);
    expect(rewardEligible('2026-11-08', '2026-11-11T04:59:00Z', 'America/Bogota')).toBe(true); // 11-10 23:59 Bogotá
    expect(rewardEligible('2026-11-08', '2026-11-11T05:00:00Z', 'America/Bogota')).toBe(false); // 11-11 00:00 Bogotá
    expect(rewardEligible('2026-11-08', '2026-11-18T12:00:00Z', 'America/Bogota')).toBe(false);
    expect(rewardEligible('2026-11-08', null, 'America/Bogota')).toBe(false);
  });
});

const DONE: DayStatus = 'food_completed';
function days(statuses: (DayStatus | 'x')[], start = '2026-10-01', eligible = true): StreakDay[] {
  return statuses.map((st, i) => ({ date: addDays(start, i), status: st === 'x' ? 'none' : st, rewardEligible: eligible && st !== 'x' }));
}

describe('computeStreaks (FR-063, FR-064)', () => {
  it('7 done + 1 missed + 1 done → current 8, freezes 0, frozen = [missed day]', () => {
    const d = days([DONE, DONE, DONE, DONE, DONE, DONE, DONE, 'x', DONE]);
    const today = addDays('2026-10-01', 8);
    expect(computeStreaks(d, today)).toMatchObject({ current: 8, longest: 8, freezesAvailable: 0, frozenDates: ['2026-10-08'] });
  });

  it('7 eligible completed days spread over 14 days earn exactly one freeze (non-consecutive)', () => {
    const d = days([DONE, 'x', DONE, 'x', DONE, 'x', DONE, 'x', DONE, 'x', DONE, 'x', DONE, 'x']);
    // Today is the unfinished last day, so the freeze earned on the 7th completion is still held.
    const r = computeStreaks(d, addDays('2026-10-01', 13));
    expect(r.eligibleCompletedDays).toBe(7);
    expect(r.freezesAvailable).toBe(1);
    // One day later the missed day consumes it.
    expect(computeStreaks(d, addDays('2026-10-01', 14))).toMatchObject({ freezesAvailable: 0, frozenDates: ['2026-10-14'] });
  });

  it('1 freeze + 2 consecutive missed days: first frozen, second breaks; never negative', () => {
    const d = days([DONE, DONE, DONE, DONE, DONE, DONE, DONE, 'x', 'x', DONE]);
    const r = computeStreaks(d, addDays('2026-10-01', 9));
    expect(r).toMatchObject({ current: 1, longest: 7, freezesAvailable: 0, frozenDates: ['2026-10-08'] });
  });

  it('freezes cap at 2', () => {
    const r = computeStreaks(days(Array(21).fill(DONE)), addDays('2026-10-01', 20));
    expect(r.freezesAvailable).toBe(2);
  });

  it('non-eligible completed days count for streak and totals but earn no freezes', () => {
    const d = days(Array(7).fill(DONE));
    for (const i of [0, 1, 2]) d[i]!.rewardEligible = false;
    const r = computeStreaks(d, addDays('2026-10-01', 6));
    expect(r).toMatchObject({ current: 7, totalCompletedDays: 7, eligibleCompletedDays: 4, freezesAvailable: 0 });
  });

  it('5 done + missed without freeze → current 0, longest 5; unfinished today does not break', () => {
    const d = days([DONE, DONE, DONE, DONE, DONE, 'x']);
    expect(computeStreaks(d, addDays('2026-10-01', 6))).toMatchObject({ current: 0, longest: 5 });
    expect(computeStreaks(days([DONE, DONE, DONE, 'food_partial']), addDays('2026-10-01', 3))).toMatchObject({ current: 3 });
  });

  it('an unfinished today never consumes a freeze', () => {
    const d = days([...Array(7).fill(DONE), 'food_partial']);
    expect(computeStreaks(d, addDays('2026-10-01', 7))).toMatchObject({ current: 7, freezesAvailable: 1, frozenDates: [] });
  });

  it('counts recorded vs completed days, across month boundaries', () => {
    const d = days(['activity_only', 'food_partial', DONE, DONE, 'x', 'rest_completed'], '2026-10-29');
    const r = computeStreaks(d, '2026-11-03');
    expect(r).toMatchObject({ totalRecordedDays: 5, totalCompletedDays: 3, current: 1, longest: 2 });
  });
});

describe('monthCompletionPct', () => {
  it('completed days ÷ elapsed days; today counts only once completed; starts at profile creation', () => {
    const d = days(Array(8).fill(DONE), '2026-11-01');
    expect(monthCompletionPct(d, '2026-11', '2026-11-08')).toBe(100);
    const partial = days([DONE, 'x', DONE, 'x', 'food_partial'], '2026-11-01');
    expect(monthCompletionPct(partial, '2026-11', '2026-11-05')).toBe(50);
    expect(monthCompletionPct([], '2026-12', '2026-11-05')).toBe(0);
    expect(monthCompletionPct(days([DONE], '2026-11-07'), '2026-11', '2026-11-08', '2026-11-07')).toBe(100);
    expect(monthCompletionPct(days(dateRange('2026-10-01', '2026-10-31').map(() => DONE)), '2026-10', '2026-11-08')).toBe(100);
  });
});
