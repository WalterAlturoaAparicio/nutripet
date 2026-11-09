/**
 * Domain constants (research.md R8, R10). Single source of truth for every number used in
 * calculations and gamification; docs/calculations.md must match these values.
 *
 * Changing any energy formula or constant that affects BMR/TDEE/targets REQUIRES bumping
 * CALC_VERSION, so day energy snapshots record which calculation produced them.
 */
import type { ActivityLevel, GoalType, Intensity, PetStage, XpSource } from './types';

export const CALC_VERSION = 1;

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  very_high: 1.9,
};

/** Mifflin-St Jeor sex constants; `unspecified` uses their mean ((5 + −161) / 2 = −78). */
export const MIFFLIN_SEX_CONSTANT = { male: 5, female: -161, unspecified: -78 } as const;

export const SAFETY_FLOOR_KCAL = 1200;
export const MAX_ADJUSTMENT_RATIO = 0.25;

export const DEFAULT_ADJUSTMENT_KCAL: Record<GoalType, number> = { gain: 300, loss: -400, maintenance: 0 };
export const ADJUSTMENT_LIMIT_KCAL = 1500;

/** The resting MET removed from activity METs so resting energy is not counted twice. */
export const RESTING_MET = 1;

/** Days after a date during which logging it still earns XP, freezes and streak rewards. */
export const BACKFILL_WINDOW_DAYS = 2;

export const XP: Record<Exclude<XpSource, 'milestone'>, { amount: number; dailyCap: number }> = {
  food_entry: { amount: 2, dailyCap: 20 },
  food_day: { amount: 15, dailyCap: 15 },
  activity: { amount: 5, dailyCap: 10 },
  activity_bonus: { amount: 1, dailyCap: 1 },
  weight: { amount: 10, dailyCap: 10 },
  streak: { amount: 10, dailyCap: 10 }, // amount is min(streak, 10); see streakBonusXp
};
export const STREAK_BONUS_MIN_STREAK = 3;
export const STREAK_BONUS_MAX = 10;
export const WEIGHT_XP_MIN_DAYS_BETWEEN = 3;

export const STAGE_THRESHOLDS: Record<PetStage, number> = {
  newborn: 0,
  young: 300,
  adolescent: 1200,
  adult: 3000,
  special: 5500,
};

export const MOOD = { min: 30, max: 100, initial: 70, missedDayPenalty: 10, actionBonus: 10, feedBonus: 15 };
export const MOOD_LABEL_THRESHOLDS = { happy: 70, content: 50 };

/** One treat per day that reaches a completed state. */
export const TREATS_PER_COMPLETED_DAY = 1;

/** One freeze for every N reward-eligible completed days (not necessarily consecutive). */
export const FREEZE_EVERY_COMPLETED_DAYS = 7;
export const MAX_FREEZES = 2;

export const FOOD_COMPLETED_MIN_OCCASIONS = 3;

export const QUANTITY_CONFIRM_ABOVE = 2000;
export const QUANTITY_MAX = 5000;

/** Default METs per built-in activity and intensity (2024 Adult Compendium of Physical Activities). */
export const DEFAULT_ACTIVITY_METS: Record<
  string,
  { nameEs: string; mets: Record<Intensity, number>; compendiumCode: string }
> = {
  walking: { nameEs: 'Caminar', mets: { light: 2.8, moderate: 3.5, vigorous: 5.0 }, compendiumCode: '17200' },
  running: { nameEs: 'Correr', mets: { light: 7.0, moderate: 9.8, vigorous: 11.5 }, compendiumCode: '12050' },
  swimming: { nameEs: 'Natación', mets: { light: 5.8, moderate: 5.8, vigorous: 9.8 }, compendiumCode: '18310' },
  cycling: { nameEs: 'Ciclismo', mets: { light: 4.0, moderate: 6.8, vigorous: 10.0 }, compendiumCode: '01015' },
  strength: { nameEs: 'Gimnasio / pesas', mets: { light: 3.5, moderate: 5.0, vigorous: 6.0 }, compendiumCode: '02050' },
  volleyball: { nameEs: 'Voleibol', mets: { light: 3.0, moderate: 4.0, vigorous: 8.0 }, compendiumCode: '15710' },
  basketball: { nameEs: 'Baloncesto', mets: { light: 4.5, moderate: 6.5, vigorous: 8.0 }, compendiumCode: '15055' },
  tennis: { nameEs: 'Tenis', mets: { light: 5.0, moderate: 7.3, vigorous: 8.0 }, compendiumCode: '15675' },
};
