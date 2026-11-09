/**
 * Deterministic 60-day demo timeline for two profiles with opposite goals and IDENTICAL logging
 * behavior (T101). Expected streak/calendar results are in tests/fixtures/demo-expected.json and are
 * derived by hand in the comments below.
 *
 * Day index i (0 = start, 59 = today):
 *   0–13  completed, logged on time (eligible)         → 2 freezes earned (at 7 and 14 eligible days)
 *   14    nothing                                      → frozen (1 freeze left)
 *   15    activity only                                → frozen (0 left)
 *   16–19 completed + activity (full_completed)        → streak 18
 *   20    food partial                                 → streak breaks (longest 18)
 *   21–27 completed + rest day (rest_completed)        → eligible count reaches 21 → 1 freeze
 *   28–34 nothing                                      → 28 frozen, 29 breaks
 *   35–44 completed but backfilled today (not eligible) → streak 10, no freezes
 *   45–58 completed on time                            → eligible 28 and 35 → 2 freezes; streak 24
 *   59    today, partial                               → does not break the streak
 */
import { addDays } from '../../src/domain/dates';
import type { LocalDate } from '../../src/domain/types';
import { setNow } from '../../src/server/clock';
import { addEntry } from '../../src/server/modules/journal/service';
import { addActivity } from '../../src/server/modules/activity/service';
import { setDayFlags } from '../../src/server/modules/calendar/service';
import { addWeight } from '../../src/server/modules/weight/service';
import { updateMe } from '../../src/server/modules/profiles/service';

export type DemoKind = 'complete' | 'none' | 'activity_only' | 'full' | 'partial' | 'rest' | 'late';

export function demoTimeline(): DemoKind[] {
  const k: DemoKind[] = [];
  for (let i = 0; i < 60; i++) {
    if (i <= 13) k.push('complete');
    else if (i === 14) k.push('none');
    else if (i === 15) k.push('activity_only');
    else if (i <= 19) k.push('full');
    else if (i === 20) k.push('partial');
    else if (i <= 27) k.push('rest');
    else if (i <= 34) k.push('none');
    else if (i <= 44) k.push('late');
    else if (i <= 58) k.push('complete');
    else k.push('partial');
  }
  return k;
}

/** Noon in Bogotá (UTC−5) of a local date. */
const noon = (d: LocalDate) => new Date(Date.parse(`${d}T17:00:00Z`));

export function demoStart(today: LocalDate): LocalDate {
  return addDays(today, -59);
}

/** Seeds one profile's timeline. The profile must already exist (created on or before the start date). */
export function seedProfileTimeline(profileId: string, today: LocalDate, foods: { a: string; b: string; c: string }, opts: { settingsChangeOnDay?: number } = {}) {
  const start = demoStart(today);
  const timeline = demoTimeline();
  const late: LocalDate[] = [];
  const logMeal = (date: LocalDate, occasion: 'breakfast' | 'lunch' | 'dinner', foodId: string, quantity: number) =>
    addEntry(profileId, date, { occasion, foodId, quantity, unit: 'g' });

  timeline.forEach((kind, i) => {
    const date = addDays(start, i);
    if (kind === 'late') {
      late.push(date);
      return;
    }
    setNow(noon(date));
    if (opts.settingsChangeOnDay === i) updateMe(profileId, { activityLevel: 'light', confirm: true });
    if (i % 3 === 0) addWeight(profileId, { date, weightKg: 70 + (i % 9) * 0.1 });
    if (kind === 'complete' || kind === 'full' || kind === 'rest') {
      logMeal(date, 'breakfast', foods.a, 100);
      logMeal(date, 'lunch', foods.b, 150);
      logMeal(date, 'dinner', foods.c, 80);
    }
    if (kind === 'partial') {
      logMeal(date, 'breakfast', foods.a, 100);
      logMeal(date, 'lunch', foods.b, 150);
    }
    if (kind === 'rest') setDayFlags(profileId, date, { restDay: true });
    if (kind === 'full' || kind === 'activity_only') {
      addActivity(profileId, date, { activityTypeId: 'builtin:walking', durationMin: 40, intensity: 'moderate', estimateMethod: 'met' });
    }
  });

  // Late backfill: these days are completed today, far outside the 2-day window.
  setNow(noon(today));
  for (const date of late) {
    logMeal(date, 'breakfast', foods.a, 100);
    logMeal(date, 'lunch', foods.b, 150);
    logMeal(date, 'dinner', foods.c, 80);
  }
  setNow(noon(today));
}
