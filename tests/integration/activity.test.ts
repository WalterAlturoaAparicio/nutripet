import { describe, expect, it } from 'vitest';
import { asProfile, call, setToday, useFreshDb } from './helpers/db';
import { createOne, setupTwoProfiles } from './helpers/fixtures';
import { seedFoods } from './helpers/foods';
import { POST as addActivityRoute } from '@/app/api/v1/days/[date]/activities/route';
import { DELETE as deleteActivityRoute, PATCH as patchActivityRoute } from '@/app/api/v1/activities/[id]/route';
import { GET as typesRoute, POST as createTypeRoute } from '@/app/api/v1/activity-types/route';
import { POST as addEntryRoute } from '@/app/api/v1/days/[date]/entries/route';
import { GET as dayRoute } from '@/app/api/v1/days/[date]/route';
import { POST as weightRoute } from '@/app/api/v1/weights/route';

useFreshDb();

const addAct = (jar: Record<string, string>, date: string, body: Record<string, unknown>) =>
  call(addActivityRoute, { jar, body, params: { date } });

describe('activities', () => {
  it('estimates with (MET − 1) × snapshot weight × hours and adds to expenditure, not to the target', async () => {
    setToday('2026-11-08');
    const ids = seedFoods();
    const a = await createOne(); // 80 kg
    const before = await call(addEntryRoute, { jar: a.jar, params: { date: '2026-11-08' }, body: { occasion: 'lunch', foodId: ids.oats, quantity: 100, unit: 'g' } });
    const target = before.body.day.target.activeKcal;
    const r = await addAct(a.jar, '2026-11-08', { activityTypeId: 'builtin:running', durationMin: 30, intensity: 'moderate', estimateMethod: 'met' });
    expect(r.status).toBe(201);
    expect(r.body.activity).toMatchObject({ metUsed: 9.8, weightKgUsed: 80, isEstimate: true });
    expect(r.body.activity.netKcal).toBeCloseTo(8.8 * 80 * 0.5, 9);
    const est = r.body.day.estimates;
    expect(est.expenditureKcal).toBeCloseTo(est.baselineTdeeKcal + 352, 9);
    expect(est.balanceKcal).toBeCloseTo(est.expenditureKcal - 379, 9);
    expect(est.balanceLabel).toBe('deficit');
    expect(est.isEstimate).toBe(true);
    expect(r.body.day.target.activeKcal).toBe(target);
  });

  it('uses the weight on or before the date for the first record of a day (via its snapshot)', async () => {
    setToday('2026-11-01');
    const a = await createOne(); // 80 kg on 11-01
    setToday('2026-11-08', 9);
    const jar = asProfile(a.id);
    await call(weightRoute, { jar, body: { date: '2026-11-06', weightKg: 78 } });
    const r = await addAct(jar, '2026-11-04', { activityTypeId: 'builtin:walking', durationMin: 60, intensity: 'moderate', estimateMethod: 'met' });
    expect(r.body.activity.weightKgUsed).toBe(80);
    const r2 = await addAct(jar, '2026-11-07', { activityTypeId: 'builtin:walking', durationMin: 60, intensity: 'moderate', estimateMethod: 'met' });
    expect(r2.body.activity.weightKgUsed).toBe(78);
  });

  it('manual estimates replace the computed one; "none" adds 0 but the entry exists', async () => {
    const today = '2026-11-08';
    setToday(today);
    const a = await createOne();
    const m = await addAct(a.jar, today, { activityTypeId: 'builtin:strength', durationMin: 60, estimateMethod: 'manual', manualKcal: 250 });
    expect(m.body.activity.netKcal).toBe(250);
    const n = await addAct(a.jar, today, { activityTypeId: 'builtin:strength', durationMin: 60, estimateMethod: 'none' });
    expect(n.body.activity.netKcal).toBe(0);
    expect(n.body.day.activities).toHaveLength(2);
    expect(n.body.day.estimates.activityNetKcal).toBe(250);
    const patched = await call(patchActivityRoute, { method: 'PATCH', jar: a.jar, params: { id: m.body.activity.id }, body: { manualKcal: 300 } });
    expect(patched.body.activity.netKcal).toBe(300);
    const del = await call(deleteActivityRoute, { method: 'DELETE', jar: a.jar, params: { id: n.body.activity.id } });
    expect(del.body.day.activities).toHaveLength(1);
  });

  it('validates duration, intensity, manual kcal and ownership', async () => {
    setToday('2026-11-08');
    const { a, b } = await setupTwoProfiles();
    expect((await addAct(a.jar, '2026-11-08', { activityTypeId: 'builtin:running', durationMin: 0, estimateMethod: 'none' })).status).toBe(422);
    expect((await addAct(a.jar, '2026-11-08', { activityTypeId: 'builtin:running', durationMin: 601, estimateMethod: 'none' })).status).toBe(422);
    expect((await addAct(a.jar, '2026-11-08', { activityTypeId: 'builtin:running', durationMin: 30, estimateMethod: 'met' })).body.error.fields.intensity).toBeTruthy();
    expect((await addAct(a.jar, '2026-11-08', { activityTypeId: 'builtin:running', durationMin: 30, estimateMethod: 'manual' })).status).toBe(422);
    expect((await addAct(a.jar, '2026-11-09', { activityTypeId: 'builtin:running', durationMin: 30, estimateMethod: 'none' })).status).toBe(422);
    const mine = await addAct(a.jar, '2026-11-08', { activityTypeId: 'builtin:tennis', durationMin: 30, intensity: 'light', estimateMethod: 'met' });
    expect((await call(patchActivityRoute, { method: 'PATCH', jar: b.jar, params: { id: mine.body.activity.id }, body: { durationMin: 5 } })).status).toBe(404);
    expect((await call(deleteActivityRoute, { method: 'DELETE', jar: b.jar, params: { id: mine.body.activity.id } })).status).toBe(404);
    expect((await call(dayRoute, { jar: b.jar, params: { date: '2026-11-08' } })).body.activities).toHaveLength(0);
  });

  it('custom types are private; a custom type without MET cannot use the MET method', async () => {
    setToday('2026-11-08');
    const { a, b } = await setupTwoProfiles();
    const t = await call(createTypeRoute, { jar: a.jar, body: { nameEs: 'Baile' } });
    expect(t.status).toBe(201);
    expect((await call(typesRoute, { jar: a.jar })).body.map((x: any) => x.nameEs)).toContain('Baile');
    expect((await call(typesRoute, { jar: b.jar })).body.map((x: any) => x.nameEs)).not.toContain('Baile');
    expect((await addAct(a.jar, '2026-11-08', { activityTypeId: t.body.id, durationMin: 30, estimateMethod: 'met' })).status).toBe(422);
    expect((await addAct(a.jar, '2026-11-08', { activityTypeId: t.body.id, durationMin: 30, estimateMethod: 'none' })).status).toBe(201);
    expect((await addAct(b.jar, '2026-11-08', { activityTypeId: t.body.id, durationMin: 30, estimateMethod: 'none' })).status).toBe(404);
  });
});
