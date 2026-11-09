import { describe, expect, it } from 'vitest';
import { addDays } from '@/domain/dates';
import { asProfile, call, setToday, useFreshDb } from './helpers/db';
import { createOne } from './helpers/fixtures';
import { seedFoods } from './helpers/foods';
import { POST as addEntryRoute } from '@/app/api/v1/days/[date]/entries/route';
import { PUT as flagsRoute } from '@/app/api/v1/days/[date]/flags/route';
import { GET as calendarRoute } from '@/app/api/v1/calendar/route';

useFreshDb();

async function completeDay(jar: Record<string, string>, date: string, foodId: string) {
  for (const occasion of ['breakfast', 'lunch', 'dinner']) {
    await call(addEntryRoute, { jar, params: { date }, body: { occasion, foodId, quantity: 50, unit: 'g' } });
  }
}

describe('backfill cannot farm streak rewards (U2)', () => {
  it('completing old days late updates calendar and totals but earns no freezes', async () => {
    setToday('2026-10-01');
    const ids = seedFoods();
    const a = await createOne();
    setToday('2026-10-25', 12);
    const jar = asProfile(a.id);
    for (let i = 0; i < 7; i++) await completeDay(jar, addDays('2026-10-05', i), ids.egg!);
    const cal = (await call(calendarRoute, { jar, url: '/api/v1/calendar?month=2026-10' })).body;
    expect(cal.streak).toMatchObject({ totalCompletedDays: 7, longest: 7, freezesAvailable: 0 });
    expect(cal.days.filter((d: any) => d.status === 'food_completed').every((d: any) => d.rewardEligible === false)).toBe(true);
  });

  it('completing days on time (within 2 days) earns the freeze', async () => {
    setToday('2026-10-01');
    const ids = seedFoods();
    const a = await createOne();
    for (let i = 0; i < 7; i++) {
      const date = addDays('2026-10-05', i);
      setToday(addDays(date, i % 3 === 0 ? 2 : 0), 12); // some logged 2 days late: still eligible
      await completeDay(asProfile(a.id), date, ids.egg!);
    }
    setToday('2026-10-12', 12);
    const cal = (await call(calendarRoute, { jar: asProfile(a.id), url: '/api/v1/calendar?month=2026-10' })).body;
    expect(cal.streak).toMatchObject({ totalCompletedDays: 7, freezesAvailable: 1 });
  });

  it('toggling "día completo" outside the window does not create eligibility', async () => {
    setToday('2026-10-01');
    const ids = seedFoods();
    const a = await createOne();
    setToday('2026-10-02', 12);
    let jar = asProfile(a.id);
    for (const occasion of ['breakfast', 'lunch']) {
      await call(addEntryRoute, { jar, params: { date: '2026-10-02' }, body: { occasion, foodId: ids.egg, quantity: 50, unit: 'g' } });
    }
    await call(flagsRoute, { method: 'PUT', jar, params: { date: '2026-10-02' }, body: { markedComplete: true } });
    let cal = (await call(calendarRoute, { jar, url: '/api/v1/calendar?month=2026-10' })).body;
    expect(cal.days.find((d: any) => d.date === '2026-10-02').rewardEligible).toBe(true);

    setToday('2026-10-20', 12);
    jar = asProfile(a.id);
    await call(flagsRoute, { method: 'PUT', jar, params: { date: '2026-10-02' }, body: { markedComplete: false } });
    await call(flagsRoute, { method: 'PUT', jar, params: { date: '2026-10-02' }, body: { markedComplete: true } });
    cal = (await call(calendarRoute, { jar, url: '/api/v1/calendar?month=2026-10' })).body;
    expect(cal.days.find((d: any) => d.date === '2026-10-02')).toMatchObject({ status: 'food_completed', rewardEligible: false });
  });
});
