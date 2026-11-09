import { describe, expect, it } from 'vitest';
import { MESSAGE_EVENTS, messageKey } from '@/domain/gamification/messages';
import { es, hasKey, t } from '@/i18n/es';
import * as rewards from '@/domain/gamification';

const GOALS = ['gain', 'loss', 'maintenance'] as const;

describe('goal-specific messaging (FR-078)', () => {
  it('returns a distinct key per goal for every event, and every key exists', () => {
    for (const event of MESSAGE_EVENTS) {
      const keys = GOALS.map((g) => messageKey(event, g));
      expect(new Set(keys).size).toBe(3);
      for (const k of keys) expect(hasKey(k), k).toBe(true);
    }
  });

  it('no message praises eating more/less, skipping meals, fasting or calorie numbers', () => {
    const forbidden = [/come m[aá]s/i, /come menos/i, /comer m[aá]s/i, /comer menos/i, /salt(a|ar|aste)/i, /ayun/i, /\bkcal\b/i, /calor[ií]as?/i, /\d{3,}/];
    const messages = Object.values(es.pet.msg).flatMap((g) => Object.values(g));
    expect(messages.length).toBeGreaterThan(0);
    for (const m of messages) for (const re of forbidden) expect(re.test(m), `"${m}" matches ${re}`).toBe(false);
  });

  it('reward functions take no goal parameter', () => {
    const fns = ['awardXp', 'streakBonusXp', 'treatsForDay', 'activityBonusXp', 'stageFor', 'feed', 'milestonesReached'] as const;
    for (const name of fns) expect((rewards[name] as unknown as (...a: unknown[]) => unknown).toString()).not.toMatch(/goal/i);
  });

  it('messages render with the helper', () => {
    expect(t(messageKey('streak_7', 'loss'))).not.toBe(messageKey('streak_7', 'loss'));
  });
});
