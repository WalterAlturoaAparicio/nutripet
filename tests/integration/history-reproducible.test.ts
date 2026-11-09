import { describe, expect, it } from 'vitest';
import { asProfile, call, setToday, useFreshDb } from './helpers/db';
import { createOne } from './helpers/fixtures';
import { seedFoods } from './helpers/foods';
import { POST as addEntryRoute } from '@/app/api/v1/days/[date]/entries/route';
import { POST as addActivityRoute } from '@/app/api/v1/days/[date]/activities/route';
import { GET as dayRoute } from '@/app/api/v1/days/[date]/route';
import { PATCH as mePatch } from '@/app/api/v1/me/route';
import { PATCH as weightPatch } from '@/app/api/v1/weights/[id]/route';
import { GET as weightsGet } from '@/app/api/v1/weights/route';

useFreshDb();

describe('reproducible history (FR-019)', () => {
  it('past days are unchanged after settings change; today uses the new version; backfill resolves older versions', async () => {
    setToday('2026-10-20');
    const ids = seedFoods();
    const a = await createOne();
    const days = ['2026-11-05', '2026-11-06', '2026-11-07'];
    const before: Record<string, unknown> = {};
    setToday('2026-11-07', 20);
    let jar = asProfile(a.id);
    for (const d of days) {
      await call(addEntryRoute, { jar, params: { date: d }, body: { occasion: 'lunch', foodId: ids.oats, quantity: 100, unit: 'g' } });
      await call(addActivityRoute, { jar, params: { date: d }, body: { activityTypeId: 'builtin:walking', durationMin: 40, intensity: 'moderate', estimateMethod: 'met' } });
      before[d] = (await call(dayRoute, { jar, params: { date: d } })).body;
    }

    setToday('2026-11-08', 9);
    jar = asProfile(a.id);
    const patched = await call(mePatch, { method: 'PATCH', jar, body: { activityLevel: 'sedentary', calorieAdjustmentKcal: 500 } });
    expect(patched.status).toBe(200);

    for (const d of days) {
      const after = (await call(dayRoute, { jar, params: { date: d } })).body;
      expect(after.target).toEqual((before[d] as any).target);
      // Everything is identical except that the day is now in the past, so its snapshot is frozen.
      const strip = (e: any) => ({ ...e, snapshot: { ...e.snapshot, frozen: undefined } });
      expect(strip(after.estimates)).toEqual(strip((before[d] as any).estimates));
      expect(after.estimates.snapshot.frozen).toBe(true);
    }

    const today = await call(addEntryRoute, { jar, params: { date: '2026-11-08' }, body: { occasion: 'lunch', foodId: ids.oats, quantity: 100, unit: 'g' } });
    const t = today.body.day;
    expect(t.estimates.activityMultiplier).toBe(1.2);
    expect(t.estimates.adjustmentKcal).toBe(500);
    expect(t.estimates.snapshot.effectiveFrom).toBe('2026-11-08');

    const backfill = await call(addEntryRoute, { jar, params: { date: '2026-10-25' }, body: { occasion: 'lunch', foodId: ids.oats, quantity: 100, unit: 'g' } });
    expect(backfill.body.day.estimates.activityMultiplier).toBe(1.55);
    expect(backfill.body.day.estimates.adjustmentKcal).toBe(300);
    expect(backfill.body.day.estimates.snapshot.effectiveFrom).toBe('2026-10-20');
  });

  it('editing a past weight record leaves existing snapshots unchanged', async () => {
    setToday('2026-11-01');
    const ids = seedFoods();
    const a = await createOne();
    setToday('2026-11-03');
    const jar = asProfile(a.id);
    await call(addEntryRoute, { jar, params: { date: '2026-11-02' }, body: { occasion: 'lunch', foodId: ids.egg, quantity: 100, unit: 'g' } });
    const before = (await call(dayRoute, { jar, params: { date: '2026-11-02' } })).body.estimates;
    const weights = (await call(weightsGet, { jar, url: '/api/v1/weights' })).body.records;
    await call(weightPatch, { method: 'PATCH', jar, params: { id: weights[0].id }, body: { weightKg: 90 } });
    const after = (await call(dayRoute, { jar, params: { date: '2026-11-02' } })).body.estimates;
    expect(after).toEqual(before);
  });

  it('a time-zone change keeps existing local dates', async () => {
    setToday('2026-11-08');
    const ids = seedFoods();
    const a = await createOne();
    await call(addEntryRoute, { jar: a.jar, params: { date: '2026-11-08' }, body: { occasion: 'dinner', foodId: ids.egg, quantity: 50, unit: 'g' } });
    await call(mePatch, { method: 'PATCH', jar: a.jar, body: { timeZone: 'Asia/Tokyo' } });
    const day = (await call(dayRoute, { jar: a.jar, params: { date: '2026-11-08' } })).body;
    expect(day.meals[0].entries).toHaveLength(1);
  });
});
