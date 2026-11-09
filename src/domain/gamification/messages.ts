/**
 * Goal-specific presentation (FR-078). Only the message chosen depends on the goal; rewards never do.
 * Texts live in src/i18n/es.ts under pet.msg.<goal>.<event>.
 */
import type { GoalType } from '../types';

export const MESSAGE_EVENTS = [
  'welcome',
  'daily',
  'food_day_completed',
  'activity_logged',
  'weight_recorded',
  'streak_7',
  'streak_14',
  'streak_30',
  'streak_60',
  'streak_100',
  'first_full_week',
  'stage_young',
  'stage_adolescent',
  'stage_adult',
  'stage_special',
  'missed_you',
  'feed',
] as const;

export type MessageEvent = (typeof MESSAGE_EVENTS)[number];

export function messageKey(event: MessageEvent, goal: GoalType): string {
  return `pet.msg.${goal}.${event}`;
}
