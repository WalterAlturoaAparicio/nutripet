import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { asProfile, call, setToday, useFreshDb } from './helpers/db';
import { createOne } from './helpers/fixtures';
import { PATCH as mePatch } from '@/app/api/v1/me/route';
import { GET as historyRoute } from '@/app/api/v1/me/settings-history/route';
import { ensureDaySnapshot } from '@/server/modules/day-energy/service';
import { db } from '@/server/db/client';
import { dayEnergySnapshot } from '@/server/db/schema';

useFreshDb();

const snapshotRow = (profileId: string, date: string) =>
  db()
    .select()
    .from(dayEnergySnapshot)
    .where(and(eq(dayEnergySnapshot.profileId, profileId), eq(dayEnergySnapshot.localDate, date)))
    .get();

describe('settings history', () => {
  it('creates a version effective today; past snapshots stay identical; today is refreshed', async () => {
    setToday('2026-11-05');
    const a = await createOne();
    ensureDaySnapshot(a.id, '2026-11-05');
    const past = snapshotRow(a.id, '2026-11-05');

    setToday('2026-11-08', 9);
    ensureDaySnapshot(a.id, '2026-11-08');
    const todayBefore = snapshotRow(a.id, '2026-11-08')!;

    // Days later the old session has expired; act through a fresh session.
    const jar = asProfile(a.id);
    const r = await call(mePatch, { method: 'PATCH', jar, body: { activityLevel: 'light' } });
    expect(r.status).toBe(200);
    expect(r.body.appliedFrom).toBe('2026-11-08');
    expect(r.body.settings.effectiveFrom).toBe('2026-11-08');
    expect(r.body.settings.activityMultiplier).toBe(1.375);

    expect(snapshotRow(a.id, '2026-11-05')).toEqual(past);
    const todayAfter = snapshotRow(a.id, '2026-11-08')!;
    expect(todayAfter.activityMultiplier).toBe(1.375);
    expect(todayAfter.baselineTdeeKcal).toBeLessThan(todayBefore.baselineTdeeKcal);
    expect(todayAfter.refreshedAt).not.toBeNull();
  });

  it('two changes on the same day: the latest wins', async () => {
    setToday('2026-11-08', 9);
    const a = await createOne();
    await call(mePatch, { method: 'PATCH', jar: a.jar, body: { calorieAdjustmentKcal: 200 } });
    setToday('2026-11-08', 11);
    const jar = asProfile(a.id);
    await call(mePatch, { method: 'PATCH', jar, body: { calorieAdjustmentKcal: 250 } });
    const h = await call(historyRoute, { jar });
    expect(h.body).toHaveLength(3);
    expect(h.body[0].calorieAdjustmentKcal).toBe(250);
    const me = await call(mePatch, { method: 'PATCH', jar, body: {} });
    expect(me.body.settings.calorieAdjustmentKcal).toBe(250);
  });

  it('non-energy changes create no version', async () => {
    const a = await createOne();
    const r = await call(mePatch, {
      method: 'PATCH',
      jar: a.jar,
      body: { name: 'Ana P', weightUnit: 'lb', foodUnit: 'imperial', targetWeightKg: 85 },
    });
    expect(r.body.appliedFrom).toBeNull();
    expect(r.body.profile.weightUnit).toBe('lb');
    expect((await call(historyRoute, { jar: a.jar })).body).toHaveLength(1);
  });

  it('values equal to the current settings create no version', async () => {
    const a = await createOne();
    const r = await call(mePatch, { method: 'PATCH', jar: a.jar, body: { activityLevel: 'moderate', heightCm: 180 } });
    expect(r.body.appliedFrom).toBeNull();
    expect((await call(historyRoute, { jar: a.jar })).body).toHaveLength(1);
  });
});
