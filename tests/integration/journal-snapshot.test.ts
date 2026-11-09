import { describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { asProfile, call, setToday, useFreshDb } from './helpers/db';
import { createOne, profileB, setupTwoProfiles } from './helpers/fixtures';
import { FIXTURE_FOODS, importFoods, seedFoods } from './helpers/foods';
import { POST as addEntryRoute } from '@/app/api/v1/days/[date]/entries/route';
import { POST as batchRoute } from '@/app/api/v1/days/[date]/entries/batch/route';
import { GET as dayRoute } from '@/app/api/v1/days/[date]/route';
import { DELETE as deleteEntryRoute, PATCH as patchEntryRoute } from '@/app/api/v1/entries/[id]/route';
import { POST as duplicateRoute } from '@/app/api/v1/meals/[mealId]/duplicate/route';
import { POST as templatesRoute } from '@/app/api/v1/templates/route';
import { POST as applyRoute } from '@/app/api/v1/templates/[id]/apply/route';
import { PATCH as mePatch } from '@/app/api/v1/me/route';
import { db } from '@/server/db/client';
import { dayEnergySnapshot } from '@/server/db/schema';

useFreshDb();

const add = (jar: Record<string, string>, date: string, body: Record<string, unknown>) =>
  call(addEntryRoute, { body, jar, params: { date } });

describe('meal journal', () => {
  it('logs the breakfast and totals match (quantity / 100) × value per 100', async () => {
    setToday('2026-11-08');
    const ids = seedFoods();
    const a = await createOne();
    const date = '2026-11-08';
    await add(a.jar, date, { occasion: 'breakfast', foodId: ids.egg, quantity: 100, unit: 'g' });
    await add(a.jar, date, { occasion: 'breakfast', foodId: ids.mango, quantity: 70, unit: 'g' });
    await add(a.jar, date, { occasion: 'breakfast', foodId: ids.milk, quantity: 200, unit: 'ml' });
    const last = await add(a.jar, date, { occasion: 'breakfast', foodId: ids.oats, quantity: 40, unit: 'g' });
    expect(last.status).toBe(201);
    const day = last.body.day;
    expect(day.meals).toHaveLength(1);
    const expectedKcal = 155 + 0.7 * 60 + 2 * 61 + 0.4 * 379;
    expect(day.totals.kcal).toBeCloseTo(expectedKcal, 9);
    expect(day.meals[0].totals.kcal).toBeCloseTo(expectedKcal, 9);
    expect(day.totals.proteinG).toBeCloseTo(12.6 + 0.56 + 6.4 + 5.28, 9);
    expect(day.incompleteNutrients).toContain('sugar');
    expect(day.meals[0].entries[0].preparationState).toBe('cooked');
    expect(day.target.remainingKcal).toBeCloseTo(day.target.activeKcal - expectedKcal, 9);
  });

  it('keeps values after a catalog update; edits recompute from the snapshot; changing the food re-snapshots', async () => {
    setToday('2026-11-08');
    const ids = seedFoods();
    const a = await createOne();
    const r = await add(a.jar, '2026-11-08', { occasion: 'lunch', foodId: ids.riceCooked, quantity: 150, unit: 'g' });
    const entryId = r.body.entry.id;
    expect(r.body.entry.nutrients.kcal).toBeCloseTo(195, 9);

    importFoods('usda_fdc', [{ ...FIXTURE_FOODS.riceCooked!, kcal: 200 }]);
    const day = await call(dayRoute, { jar: a.jar, params: { date: '2026-11-08' } });
    expect(day.body.meals[0].entries[0].nutrients.kcal).toBeCloseTo(195, 9);

    const edited = await call(patchEntryRoute, { method: 'PATCH', jar: a.jar, params: { id: entryId }, body: { quantity: 300 } });
    expect(edited.body.entry.nutrients.kcal).toBeCloseTo(390, 9);

    const fresh = await add(a.jar, '2026-11-08', { occasion: 'dinner', foodId: ids.riceCooked, quantity: 100, unit: 'g' });
    expect(fresh.body.entry.nutrients.kcal).toBeCloseTo(200, 9);

    const changed = await call(patchEntryRoute, { method: 'PATCH', jar: a.jar, params: { id: entryId }, body: { foodId: ids.plantain } });
    expect(changed.body.entry.name).toBe('Plátano maduro, crudo');
    expect(changed.body.entry.nutrients.kcal).toBeCloseTo(3 * 122, 9);
    expect(changed.body.entry.preparationState).toBe('raw');
  });

  it('flags ml→g without density as approximate', async () => {
    const ids = seedFoods();
    const a = await createOne();
    const r = await add(a.jar, a ? '2026-11-08' : '', { occasion: 'breakfast', foodId: ids.noDensityJuice, quantity: 200, unit: 'ml' });
    expect(r.body.entry.approximate).toBe(true);
    expect(r.body.entry.nutrients.kcal).toBeCloseTo(90, 9);
  });

  it('creates the day energy snapshot on the first entry; backfill uses the settings effective then', async () => {
    setToday('2026-11-01');
    const ids = seedFoods();
    const a = await createOne();
    setToday('2026-11-08', 9);
    const jar = asProfile(a.id);
    await call(mePatch, { method: 'PATCH', jar, body: { activityLevel: 'light' } });
    await add(jar, '2026-11-03', { occasion: 'lunch', foodId: ids.egg, quantity: 50, unit: 'g' });
    const snap = db()
      .select()
      .from(dayEnergySnapshot)
      .where(and(eq(dayEnergySnapshot.profileId, a.id), eq(dayEnergySnapshot.localDate, '2026-11-03')))
      .get()!;
    expect(snap.activityMultiplier).toBe(1.55);
  });

  it('validates dates, quantities, ownership', async () => {
    setToday('2026-11-08');
    const ids = seedFoods();
    const { a, b } = await setupTwoProfiles();
    expect((await add(a.jar, '2026-11-09', { occasion: 'lunch', foodId: ids.egg, quantity: 50, unit: 'g' })).status).toBe(422);
    expect((await add(a.jar, 'nope', { occasion: 'lunch', foodId: ids.egg, quantity: 50, unit: 'g' })).status).toBe(422);
    const big = await add(a.jar, '2026-11-08', { occasion: 'lunch', foodId: ids.egg, quantity: 2500, unit: 'g' });
    expect(big.status).toBe(409);
    expect(big.body.error.code).toBe('CONFIRM_REQUIRED');
    expect((await add(a.jar, '2026-11-08', { occasion: 'lunch', foodId: ids.egg, quantity: 2500, unit: 'g', confirm: true })).status).toBe(201);
    expect((await add(a.jar, '2026-11-08', { occasion: 'lunch', foodId: ids.egg, quantity: 6000, unit: 'g', confirm: true })).status).toBe(422);
    expect((await add(a.jar, '2026-11-08', { occasion: 'extra', foodId: ids.egg, quantity: 10, unit: 'g' })).status).toBe(422);

    const mine = await add(a.jar, '2026-11-08', { occasion: 'dinner', foodId: ids.egg, quantity: 50, unit: 'g' });
    const id = mine.body.entry.id;
    expect((await call(patchEntryRoute, { method: 'PATCH', jar: b.jar, params: { id }, body: { quantity: 1 } })).status).toBe(404);
    expect((await call(deleteEntryRoute, { method: 'DELETE', jar: b.jar, params: { id } })).status).toBe(404);
    const bDay = await call(dayRoute, { jar: b.jar, params: { date: '2026-11-08' } });
    expect(bDay.body.meals).toHaveLength(0);
    void profileB;
  });

  it('deletes entries and empty meals, duplicates meals, and applies templates in one action', async () => {
    setToday('2026-11-08');
    const ids = seedFoods();
    const a = await createOne();
    const batch = await call(batchRoute, {
      jar: a.jar,
      params: { date: '2026-11-07' },
      body: { occasion: 'breakfast', items: [{ foodId: ids.egg, quantity: 100, unit: 'g' }, { foodId: ids.milk, quantity: 200, unit: 'ml' }] },
    });
    expect(batch.status).toBe(201);
    const mealId = batch.body.day.meals[0].id;

    const dup = await call(duplicateRoute, { jar: a.jar, params: { mealId }, body: { toDate: '2026-11-08', toOccasion: 'breakfast' } });
    expect(dup.status).toBe(201);
    expect(dup.body.day.meals[0].entries).toHaveLength(2);

    const tpl = await call(templatesRoute, { jar: a.jar, body: { name: 'Desayuno típico', fromMealId: mealId } });
    expect(tpl.status).toBe(201);
    const applied = await call(applyRoute, { jar: a.jar, params: { id: tpl.body.id }, body: { date: '2026-11-08', occasion: 'extra', label: 'Media tarde' } });
    expect(applied.body.day.meals.find((m: any) => m.occasion === 'extra').entries).toHaveLength(2);

    const entryIds = dup.body.entries.map((e: any) => e.id);
    for (const id of entryIds) await call(deleteEntryRoute, { method: 'DELETE', jar: a.jar, params: { id } });
    const day = await call(dayRoute, { jar: a.jar, params: { date: '2026-11-08' } });
    expect(day.body.meals.map((m: any) => m.occasion)).toEqual(['extra']);
  });
});
