import { describe, expect, it } from 'vitest';
import expected from '../fixtures/demo-expected.json';
import { asProfile, call, setToday, useFreshDb } from './helpers/db';
import { profileA, profileB } from './helpers/fixtures';
import { seedFoods } from './helpers/foods';
import { POST as createRoute } from '@/app/api/v1/profiles/route';
import { GET as calendarRoute } from '@/app/api/v1/calendar/route';
import { computeStreaks } from '@/domain/tracking';
import { streakDays } from '@/server/modules/calendar/service';
import { seedProfileTimeline } from '../../scripts/demo/seed';

useFreshDb();

describe('demo seed timeline (quickstart 9)', () => {
  it('produces the hand-derived streak and calendar results, identically for both goals', async () => {
    setToday(expected.start, 7);
    const ids = seedFoods();
    const ra = await call(createRoute, { body: profileA });
    const rb = await call(createRoute, { body: profileB, jar: ra.jar });
    const foods = { a: ids.egg!, b: ids.riceCooked!, c: ids.oats! };
    seedProfileTimeline(ra.body.profile.id, expected.today, foods, { settingsChangeOnDay: 30 });
    seedProfileTimeline(rb.body.profile.id, expected.today, foods);
    setToday(expected.today, 12);

    for (const id of [ra.body.profile.id, rb.body.profile.id]) {
      const jar = asProfile(id);
      const nov = (await call(calendarRoute, { jar, url: '/api/v1/calendar?month=2026-11' })).body;
      const oct = (await call(calendarRoute, { jar, url: '/api/v1/calendar?month=2026-10' })).body;
      const sep = (await call(calendarRoute, { jar, url: '/api/v1/calendar?month=2026-09' })).body;
      expect(nov.streak).toEqual(expected.streak);
      expect(nov.monthCompletionPct).toBe(expected.monthCompletionPct['2026-11']);
      expect(oct.monthCompletionPct).toBe(expected.monthCompletionPct['2026-10']);
      const all = [...sep.days, ...oct.days, ...nov.days];
      const byDate = new Map(all.map((d: any) => [d.date, d]));
      expect(all.filter((d: any) => d.frozen).map((d: any) => d.date)).toEqual(expected.frozenDates);
      for (const [date, status] of Object.entries(expected.states)) expect(byDate.get(date).status).toBe(status);
      for (const d of expected.notRewardEligible) expect(byDate.get(d).rewardEligible).toBe(false);
      for (const d of expected.rewardEligible) expect(byDate.get(d).rewardEligible).toBe(true);
      expect(computeStreaks(streakDays(id), expected.today).frozenDates).toEqual(expected.frozenDates);
    }
  });
});
