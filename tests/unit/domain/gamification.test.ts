import { describe, expect, it } from 'vitest';
import {
  activityBonusXp,
  applyMoodDecay,
  awardXp,
  dayRewardsToRevoke,
  feed,
  milestonesReached,
  moodLabel,
  moodOnAction,
  nextStageXp,
  progressPct,
  stageFor,
  streakBonusXp,
  treatsForDay,
  weightXpAllowed,
} from '@/domain/gamification';

describe('awardXp (caps per logged date, backfill window)', () => {
  it('20 food entries on one date → 10 awards of 2 XP (cap 20)', () => {
    const events: { source: 'food_entry'; amount: number }[] = [];
    let awarded = 0;
    for (let i = 0; i < 20; i++) {
      const a = awardXp(events, { source: 'food_entry', loggedDate: '2026-11-08' }, '2026-11-08');
      if (a) {
        events.push({ source: 'food_entry', amount: a });
        awarded++;
      }
    }
    expect(awarded).toBe(10);
    expect(events.reduce((s, e) => s + e.amount, 0)).toBe(20);
  });

  it('only for logged dates within the last 2 days', () => {
    expect(awardXp([], { source: 'activity', loggedDate: '2026-11-06' }, '2026-11-08')).toBe(5);
    expect(awardXp([], { source: 'activity', loggedDate: '2026-11-05' }, '2026-11-08')).toBeNull();
  });

  it('respects explicit amounts (streak bonus) and caps them', () => {
    expect(awardXp([], { source: 'streak', loggedDate: '2026-11-08', amount: 7 }, '2026-11-08')).toBe(7);
    expect(awardXp([{ source: 'streak', amount: 7 }], { source: 'streak', loggedDate: '2026-11-08', amount: 7 }, '2026-11-08')).toBe(3);
  });

  it('activity bonus is 1 XP max per day', () => {
    expect(awardXp([], { source: 'activity_bonus', loggedDate: '2026-11-08' }, '2026-11-08')).toBe(1);
    expect(awardXp([{ source: 'activity_bonus', amount: 1 }], { source: 'activity_bonus', loggedDate: '2026-11-08' }, '2026-11-08')).toBeNull();
  });
});

describe('reward rules', () => {
  it('streak bonus = min(streak, 10) from 3 days', () => {
    expect(streakBonusXp(2)).toBe(0);
    expect(streakBonusXp(3)).toBe(3);
    expect(streakBonusXp(25)).toBe(10);
  });
  it('weight XP at most once every 3 days', () => {
    expect(weightXpAllowed(null, '2026-11-08')).toBe(true);
    expect(weightXpAllowed('2026-11-06', '2026-11-08')).toBe(false);
    expect(weightXpAllowed('2026-11-05', '2026-11-08')).toBe(true);
  });
  it('treats and activity bonus require a completed day (A2)', () => {
    expect(treatsForDay('activity_only')).toBe(0);
    expect(treatsForDay('food_partial')).toBe(0);
    expect(treatsForDay('none')).toBe(0);
    expect(treatsForDay('food_completed')).toBe(1);
    expect(treatsForDay('full_completed')).toBe(1);
    expect(treatsForDay('rest_completed')).toBe(1);
    expect(activityBonusXp('full_completed', 1)).toBe(1);
    expect(activityBonusXp('food_partial', 2)).toBe(0);
    expect(activityBonusXp('activity_only', 2)).toBe(0);
    expect(activityBonusXp('food_completed', 0)).toBe(0);
  });
  it('leaving a completed state revokes day-level rewards', () => {
    expect(dayRewardsToRevoke('food_completed', 'food_partial')).toEqual(['food_day', 'activity_bonus', 'streak', 'treat']);
    expect(dayRewardsToRevoke('full_completed', 'food_completed')).toEqual(['activity_bonus']);
    expect(dayRewardsToRevoke('food_partial', 'food_completed')).toEqual([]);
  });
});

describe('stages', () => {
  it('thresholds 0/300/1200/3000/5500', () => {
    expect(stageFor(0)).toBe('newborn');
    expect(stageFor(299)).toBe('newborn');
    expect(stageFor(300)).toBe('young');
    expect(stageFor(1200)).toBe('adolescent');
    expect(stageFor(2999)).toBe('adolescent');
    expect(stageFor(3000)).toBe('adult');
    expect(stageFor(5500)).toBe('special');
    expect(nextStageXp(299)).toBe(300);
    expect(nextStageXp(6000)).toBeNull();
    expect(progressPct(750)).toBe(50);
    expect(progressPct(6000)).toBe(100);
  });
});

describe('mood', () => {
  it('decays −10 per missed day with a floor of 30; +10 on action; +15 on feeding (cap 100)', () => {
    expect(applyMoodDecay(40, 5)).toBe(30);
    expect(applyMoodDecay(90, 2)).toBe(70);
    expect(moodOnAction(95)).toBe(100);
    expect(feed({ treats: 2, mood: 90 })).toEqual({ treats: 1, mood: 100 });
    expect(() => feed({ treats: 0, mood: 50 })).toThrow('no_treats');
  });
  it('labels', () => {
    expect(moodLabel(70)).toBe('happy');
    expect(moodLabel(50)).toBe('content');
    expect(moodLabel(30)).toBe('sleepy');
  });
});

describe('milestones', () => {
  it('streak milestones use reward-eligible streak lengths; stages and first week', () => {
    expect(milestonesReached({ bestEligibleStreak: 8, eligibleCompletedDays: 8, maxXp: 310 })).toEqual(
      expect.arrayContaining(['streak_7', 'first_full_week', 'stage_young']),
    );
    expect(milestonesReached({ bestEligibleStreak: 6, eligibleCompletedDays: 3, maxXp: 0 })).toEqual([]);
  });
});
