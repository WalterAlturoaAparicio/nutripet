/**
 * Pure reference simulation of the reward economy over a day-by-day action timeline, using the same
 * rules as the server. Used by property tests to prove goal-independence (FR-072, SC-007).
 */
import { MOOD } from '../config';
import { addDays } from '../dates';
import { computeStreaks, dayStatus, isCompleted, type StreakDay } from '../tracking';
import type { GoalType, LocalDate, XpSource } from '../types';
import {
  activityBonusXp,
  applyMoodDecay,
  awardXp,
  MILESTONE_REWARDS,
  milestonesReached,
  moodOnAction,
  stageFor,
  streakBonusXp,
  treatsForDay,
  weightXpAllowed,
  type MilestoneId,
} from './index';
import { messageKey, type MessageEvent } from './messages';

export type SimAction =
  | { kind: 'food'; occasion: number; kcal: number }
  | { kind: 'activity' }
  | { kind: 'weight' }
  | { kind: 'delete_last_food' };

const STAGE_ORDER = ['newborn', 'young', 'adolescent', 'adult', 'special'];

export function simulateRewards(timeline: SimAction[][], goal: GoalType, start: LocalDate) {
  const events: { source: XpSource; amount: number; date: LocalDate }[] = [];
  const unlocked = new Set<MilestoneId>();
  const streakDays: StreakDay[] = [];
  let treats = 0;
  let mood: number = MOOD.initial;
  let maxXp = 0;
  let lastWeight: LocalDate | null = null;
  const stageHistory: number[] = [];
  const messages: string[] = [];
  const say = (e: MessageEvent) => messages.push(messageKey(e, goal));

  timeline.forEach((actions, i) => {
    const date = addDays(start, i);
    const foods: { occasion: number; xp: number }[] = [];
    let activities = 0;
    if (actions.length === 0) mood = applyMoodDecay(mood, 1);
    for (const a of actions) {
      const forDate = (s: XpSource) => events.filter((e) => e.date === date && e.source === s);
      if (a.kind === 'food') {
        const xp = awardXp(forDate('food_entry'), { source: 'food_entry', loggedDate: date }, date) ?? 0;
        if (xp) events.push({ source: 'food_entry', amount: xp, date });
        foods.push({ occasion: a.occasion, xp });
      } else if (a.kind === 'delete_last_food') {
        const f = foods.pop();
        if (f?.xp) {
          const idx = events.findIndex((e) => e.date === date && e.source === 'food_entry');
          if (idx >= 0) events.splice(idx, 1);
        }
      } else if (a.kind === 'activity') {
        activities++;
        const xp = awardXp(forDate('activity'), { source: 'activity', loggedDate: date }, date);
        if (xp) events.push({ source: 'activity', amount: xp, date });
      } else if (a.kind === 'weight' && weightXpAllowed(lastWeight, date)) {
        const xp = awardXp(forDate('weight'), { source: 'weight', loggedDate: date }, date);
        if (xp) {
          events.push({ source: 'weight', amount: xp, date });
          lastWeight = date;
        }
      }
      mood = moodOnAction(mood);
    }
    const status = dayStatus({
      foodEntryCount: foods.length,
      occasionsWithEntries: new Set(foods.map((f) => f.occasion)).size,
      markedComplete: false,
      activityCount: activities,
      restDay: false,
    });
    streakDays.push({ date, status, rewardEligible: isCompleted(status) });
    if (isCompleted(status)) {
      events.push({ source: 'food_day', amount: 15, date });
      treats += treatsForDay(status);
      const bonus = activityBonusXp(status, activities);
      if (bonus) events.push({ source: 'activity_bonus', amount: bonus, date });
      const streak = computeStreaks(streakDays, date).current;
      const sb = streakBonusXp(streak);
      if (sb) events.push({ source: 'streak', amount: sb, date });
      say('food_day_completed');
    }
    const st = computeStreaks(streakDays, date);
    const best = Math.max(0, ...Object.values(st.streakOn));
    let total = events.reduce((s, e) => s + e.amount, 0);
    for (const m of milestonesReached({ bestEligibleStreak: best, eligibleCompletedDays: st.eligibleCompletedDays, maxXp: Math.max(maxXp, total) })) {
      if (unlocked.has(m)) continue;
      unlocked.add(m);
      const r = MILESTONE_REWARDS[m];
      if (r.xp) events.push({ source: 'milestone', amount: r.xp, date });
      treats += r.treats;
      say(m);
    }
    total = events.reduce((s, e) => s + e.amount, 0);
    maxXp = Math.max(maxXp, total);
    stageHistory.push(STAGE_ORDER.indexOf(stageFor(maxXp)));
  });

  const finalStreaks = computeStreaks(streakDays, addDays(start, timeline.length - 1));
  return {
    xpTotal: events.reduce((s, e) => s + e.amount, 0),
    maxXp,
    stage: stageFor(maxXp),
    stageHistory,
    treats,
    mood,
    milestones: [...unlocked].sort(),
    freezes: finalStreaks.freezesAvailable,
    streak: finalStreaks.current,
    messages,
  };
}
