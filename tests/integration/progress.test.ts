import { describe, expect, it } from 'vitest';
import { asProfile, call, setToday, useFreshDb } from './helpers/db';
import { createOne } from './helpers/fixtures';
import { seedFoods } from './helpers/foods';
import { POST as addEntryRoute } from '@/app/api/v1/days/[date]/entries/route';
import { GET as dayRoute } from '@/app/api/v1/days/[date]/route';
import { GET as progressRoute } from '@/app/api/v1/progress/route';

useFreshDb();

describe('progress summaries', () => {
  it('week: averages over days with data, same sign convention as the dashboard', async () => {
    setToday('2026-11-01');
    const ids = seedFoods();
    const a = await createOne();
    setToday('2026-11-08', 20);
    const jar = asProfile(a.id);
    for (const d of ['2026-11-03', '2026-11-05', '2026-11-08']) {
      await call(addEntryRoute, { jar, params: { date: d }, body: { occasion: 'lunch', foodId: ids.oats, quantity: 300, unit: 'g' } });
    }
    const r = (await call(progressRoute, { jar, url: '/api/v1/progress?period=week' })).body;
    expect(r).toMatchObject({ start: '2026-11-02', end: '2026-11-08', daysWithData: 3, daysInPeriod: 7, isEstimate: true });
    expect(r.avgIntakeKcal).toBeCloseTo(3 * 379, 9);
    const day = (await call(dayRoute, { jar, params: { date: '2026-11-08' } })).body;
    expect(Math.sign(r.avgBalanceKcal)).toBe(Math.sign(day.estimates.balanceKcal));
    expect(r.balanceLabel).toBe(day.estimates.balanceLabel);
    const m = (await call(progressRoute, { jar, url: '/api/v1/progress?period=month&end=2026-11-08' })).body;
    expect(m).toMatchObject({ start: '2026-11-01', daysInPeriod: 8, daysWithData: 3 });
  });
});
