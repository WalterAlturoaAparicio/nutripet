/**
 * Gamification rules (FR-070–FR-078, research.md R10). No function here reads goal type, calories or
 * targets: identical tracking behavior yields identical rewards (Constitution IV).
 */
import {
  BACKFILL_WINDOW_DAYS,
  MOOD,
  MOOD_LABEL_THRESHOLDS,
  STAGE_THRESHOLDS,
  STREAK_BONUS_MAX,
  STREAK_BONUS_MIN_STREAK,
  TREATS_PER_COMPLETED_DAY,
  WEIGHT_XP_MIN_DAYS_BETWEEN,
  XP,
} from '../config';
import { addDays, daysBetween } from '../dates';
import { isCompleted } from '../tracking';
import type { DayStatus, LocalDate, PetStage, XpSource } from '../types';
import { PET_STAGES } from '../types';

type CappedSource = Exclude<XpSource, 'milestone'>;

/**
 * XP granted for a candidate event given the non-revoked events already awarded for the same logged
 * date and source; null if nothing can be granted (cap reached or outside the backfill window).
 */
export function awardXp(
  existingForDateAndSource: { source: XpSource; amount: number }[],
  candidate: { source: CappedSource; loggedDate: LocalDate; amount?: number },
  today: LocalDate,
): number | null {
  if (candidate.loggedDate < addDays(today, -BACKFILL_WINDOW_DAYS) || candidate.loggedDate > today) return null;
  const rule = XP[candidate.source];
  const used = existingForDateAndSource.filter((e) => e.source === candidate.source).reduce((s, e) => s + e.amount, 0);
  const amount = Math.min(candidate.amount ?? rule.amount, rule.dailyCap - used);
  return amount > 0 ? amount : null;
}

export function streakBonusXp(streak: number): number {
  return streak >= STREAK_BONUS_MIN_STREAK ? Math.min(streak, STREAK_BONUS_MAX) : 0;
}

export function weightXpAllowed(lastRewardedDate: LocalDate | null, date: LocalDate): boolean {
  return lastRewardedDate === null || Math.abs(daysBetween(lastRewardedDate, date)) >= WEIGHT_XP_MIN_DAYS_BETWEEN;
}

/** One treat per day that reaches a completed state; activity-only days give none (FR-075). */
export function treatsForDay(status: DayStatus): number {
  return isCompleted(status) ? TREATS_PER_COMPLETED_DAY : 0;
}

/** +1 XP only on completed days with at least one activity. */
export function activityBonusXp(status: DayStatus, activityCount: number): number {
  return isCompleted(status) && activityCount > 0 ? XP.activity_bonus.amount : 0;
}

export type DayReward = 'food_day' | 'activity_bonus' | 'streak' | 'treat';

/** Day-level rewards to revoke when a day's status changes (FR-071). */
export function dayRewardsToRevoke(prev: DayStatus, next: DayStatus): DayReward[] {
  if (isCompleted(prev) && !isCompleted(next)) return ['food_day', 'activity_bonus', 'streak', 'treat'];
  if (prev === 'full_completed' && next !== 'full_completed' && isCompleted(next)) return ['activity_bonus'];
  return [];
}

/** Stage from the highest XP ever reached, so it never decreases (FR-074). */
export function stageFor(maxXpReached: number): PetStage {
  let stage: PetStage = 'newborn';
  for (const s of PET_STAGES) if (maxXpReached >= STAGE_THRESHOLDS[s]) stage = s;
  return stage;
}

export function nextStageXp(maxXpReached: number): number | null {
  const next = PET_STAGES.find((s) => STAGE_THRESHOLDS[s] > maxXpReached);
  return next ? STAGE_THRESHOLDS[next] : null;
}

export function progressPct(maxXpReached: number): number {
  const stage = stageFor(maxXpReached);
  const next = nextStageXp(maxXpReached);
  if (next === null) return 100;
  const base = STAGE_THRESHOLDS[stage];
  return Math.floor(((maxXpReached - base) / (next - base)) * 100);
}

export function applyMoodDecay(mood: number, missedDays: number): number {
  return Math.max(MOOD.min, mood - MOOD.missedDayPenalty * missedDays);
}

export function moodOnAction(mood: number): number {
  return Math.min(MOOD.max, mood + MOOD.actionBonus);
}

export function feed(pet: { treats: number; mood: number }): { treats: number; mood: number } {
  if (pet.treats <= 0) throw new Error('no_treats');
  return { treats: pet.treats - 1, mood: Math.min(MOOD.max, pet.mood + MOOD.feedBonus) };
}

export type MoodLabel = 'happy' | 'content' | 'sleepy';
export function moodLabel(mood: number): MoodLabel {
  if (mood >= MOOD_LABEL_THRESHOLDS.happy) return 'happy';
  if (mood >= MOOD_LABEL_THRESHOLDS.content) return 'content';
  return 'sleepy';
}

export const STREAK_MILESTONES = [7, 14, 30, 60, 100] as const;

export type MilestoneId =
  | `streak_${(typeof STREAK_MILESTONES)[number]}`
  | 'first_full_week'
  | `stage_${Exclude<PetStage, 'newborn'>}`;

/** Milestones reached; streak milestones count only reward-eligible streak lengths (U2). */
export function milestonesReached(stats: { bestEligibleStreak: number; eligibleCompletedDays: number; maxXp: number }): MilestoneId[] {
  const out: MilestoneId[] = [];
  for (const n of STREAK_MILESTONES) if (stats.bestEligibleStreak >= n) out.push(`streak_${n}`);
  if (stats.eligibleCompletedDays >= 7) out.push('first_full_week');
  for (const s of PET_STAGES) if (s !== 'newborn' && stats.maxXp >= STAGE_THRESHOLDS[s]) out.push(`stage_${s}`);
  return out;
}

/** Rewards per milestone (identical for every goal). Accessories unlock cosmetics only. */
export const MILESTONE_REWARDS: Record<MilestoneId, { xp: number; treats: number; accessory: string | null }> = {
  streak_7: { xp: 25, treats: 1, accessory: 'gorro' },
  streak_14: { xp: 50, treats: 1, accessory: 'bufanda' },
  streak_30: { xp: 75, treats: 2, accessory: 'mono' },
  streak_60: { xp: 100, treats: 2, accessory: 'gafas' },
  streak_100: { xp: 100, treats: 3, accessory: 'corona' },
  first_full_week: { xp: 25, treats: 1, accessory: null },
  stage_young: { xp: 0, treats: 1, accessory: null },
  stage_adolescent: { xp: 0, treats: 1, accessory: null },
  stage_adult: { xp: 0, treats: 1, accessory: null },
  stage_special: { xp: 0, treats: 2, accessory: null },
};
