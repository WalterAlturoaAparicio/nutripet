import { describe, expect, it } from 'vitest';
import { call, setToday, useFreshDb } from './helpers/db';
import { setupTwoProfiles } from './helpers/fixtures';
import { seedFoods } from './helpers/foods';
import { GET as searchRoute, POST as createFoodRoute } from '@/app/api/v1/foods/route';
import { DELETE as hideRoute, GET as foodRoute, PATCH as patchFoodRoute } from '@/app/api/v1/foods/[id]/route';
import { DELETE as unOverrideRoute, POST as overrideRoute } from '@/app/api/v1/foods/[id]/override/route';
import { DELETE as unfavRoute, PUT as favRoute } from '@/app/api/v1/foods/[id]/favorite/route';
import { GET as quickRoute } from '@/app/api/v1/foods/quick/route';
import { POST as addEntryRoute } from '@/app/api/v1/days/[date]/entries/route';
import { GET as dayRoute } from '@/app/api/v1/days/[date]/route';

useFreshDb();

const arepa = {
  nameEs: 'Arepa de maíz (casera)',
  aliases: ['arepa casera'],
  category: 'cereales',
  preparationState: 'prepared',
  basis: 'g',
  kcal: 210,
  proteinG: 4.5,
  carbsG: 42,
  fatG: 2.5,
  fiberG: null,
  sourceNote: 'Receta propia calculada con ingredientes pesados',
};

const search = (jar: Record<string, string>, q: string) => call(searchRoute, { jar, url: `/api/v1/foods?q=${encodeURIComponent(q)}` });

describe('custom foods', () => {
  it('are searchable only by their owner, marked as user-created, and loggable', async () => {
    setToday('2026-11-08');
    const { a, b } = await setupTwoProfiles();
    const r = await call(createFoodRoute, { jar: a.jar, body: arepa });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ nameEs: 'Arepa de maíz (casera)', isCustom: true, source: { id: 'user' }, per100: { fiberG: null } });
    expect((await search(a.jar, 'arepa casera')).body.items[0]).toMatchObject({ id: r.body.id, source: 'user', isCustom: true });
    expect((await search(b.jar, 'arepa casera')).body).toEqual({ items: [], suggestCustomFood: true });
    expect((await call(foodRoute, { jar: b.jar, params: { id: r.body.id } })).status).toBe(404);
    const e = await call(addEntryRoute, { jar: a.jar, params: { date: '2026-11-08' }, body: { occasion: 'breakfast', foodId: r.body.id, quantity: 130, unit: 'g' } });
    expect(e.body.entry.nutrients.kcal).toBeCloseTo(273, 9);
    expect(e.body.entry.source).toBe('user');
  });

  it('validates required source note and nutrient consistency', async () => {
    const { a } = await setupTwoProfiles();
    expect((await call(createFoodRoute, { jar: a.jar, body: { ...arepa, sourceNote: '' } })).status).toBe(422);
    expect((await call(createFoodRoute, { jar: a.jar, body: { ...arepa, proteinG: 60, carbsG: 50 } })).status).toBe(422);
    expect((await call(createFoodRoute, { jar: a.jar, body: { ...arepa, sugarG: 50 } })).status).toBe(422);
  });

  it('editing a custom food creates a new version; past entries keep their values; hiding keeps entries', async () => {
    setToday('2026-11-08');
    const { a, b } = await setupTwoProfiles();
    const f = (await call(createFoodRoute, { jar: a.jar, body: arepa })).body;
    await call(addEntryRoute, { jar: a.jar, params: { date: '2026-11-08' }, body: { occasion: 'breakfast', foodId: f.id, quantity: 100, unit: 'g' } });
    const patched = await call(patchFoodRoute, { method: 'PATCH', jar: a.jar, params: { id: f.id }, body: { nutrients: { basis: 'g', kcal: 230, proteinG: 5, carbsG: 45, fatG: 3 } } });
    expect(patched.body).toMatchObject({ versionNo: 2, per100: { kcal: 230 } });
    expect((await call(patchFoodRoute, { method: 'PATCH', jar: b.jar, params: { id: f.id }, body: { nameEs: 'x' } })).status).toBe(404);
    expect((await call(hideRoute, { method: 'DELETE', jar: a.jar, params: { id: f.id } })).status).toBe(204);
    expect((await search(a.jar, 'arepa casera')).body.items).toHaveLength(0);
    const day = await call(dayRoute, { jar: a.jar, params: { date: '2026-11-08' } });
    expect(day.body.meals[0].entries[0].nutrients.kcal).toBeCloseTo(210, 9);
  });
});

describe('corrections (overrides)', () => {
  it('affect only that profile and new entries; deleting the override reverts', async () => {
    setToday('2026-11-08');
    const ids = seedFoods();
    const { a, b } = await setupTwoProfiles();
    const before = await call(addEntryRoute, { jar: a.jar, params: { date: '2026-11-08' }, body: { occasion: 'lunch', foodId: ids.riceCooked, quantity: 100, unit: 'g' } });
    expect(before.body.entry.nutrients.kcal).toBeCloseTo(130, 9);

    const o = await call(overrideRoute, { jar: a.jar, params: { id: ids.riceCooked! }, body: { basis: 'g', kcal: 140, proteinG: 2.7, carbsG: 30, fatG: 0.3, note: 'etiqueta' } });
    expect(o.body).toMatchObject({ hasOverride: true, per100: { kcal: 140 }, source: { id: 'user_correction' } });
    expect((await search(a.jar, 'arroz')).body.items[0]).toMatchObject({ id: ids.riceCooked, kcalPer100: 140, hasOverride: true, source: 'user_correction' });
    expect((await search(b.jar, 'arroz')).body.items.find((f: any) => f.id === ids.riceCooked)).toMatchObject({ kcalPer100: 130, hasOverride: false });

    const after = await call(addEntryRoute, { jar: a.jar, params: { date: '2026-11-08' }, body: { occasion: 'dinner', foodId: ids.riceCooked, quantity: 100, unit: 'g' } });
    expect(after.body.entry.nutrients.kcal).toBeCloseTo(140, 9);
    expect(after.body.entry.source).toBe('user_correction');
    const bEntry = await call(addEntryRoute, { jar: b.jar, params: { date: '2026-11-08' }, body: { occasion: 'dinner', foodId: ids.riceCooked, quantity: 100, unit: 'g' } });
    expect(bEntry.body.entry.nutrients.kcal).toBeCloseTo(130, 9);
    const day = await call(dayRoute, { jar: a.jar, params: { date: '2026-11-08' } });
    expect(day.body.meals.find((m: any) => m.occasion === 'lunch').entries[0].nutrients.kcal).toBeCloseTo(130, 9);

    const reverted = await call(unOverrideRoute, { method: 'DELETE', jar: a.jar, params: { id: ids.riceCooked! } });
    expect(reverted.body).toMatchObject({ hasOverride: false, per100: { kcal: 130 } });
  });
});

describe('favorites and quick lists', () => {
  it('favorites appear first; frequent = most logged in 30 days with the last quantity; templates included', async () => {
    setToday('2026-11-08');
    const ids = seedFoods();
    const { a, b } = await setupTwoProfiles();
    expect((await call(favRoute, { method: 'PUT', jar: a.jar, params: { id: ids.mango! } })).status).toBe(204);
    for (let i = 0; i < 5; i++) {
      await call(addEntryRoute, { jar: a.jar, params: { date: '2026-11-08' }, body: { occasion: 'breakfast', foodId: ids.egg, quantity: 50 + i, unit: 'g' } });
    }
    await call(addEntryRoute, { jar: a.jar, params: { date: '2026-11-08' }, body: { occasion: 'lunch', foodId: ids.oats, quantity: 40, unit: 'g' } });
    const q = (await call(quickRoute, { jar: a.jar })).body;
    expect(q.favorites.map((f: any) => f.id)).toEqual([ids.mango]);
    expect(q.frequent[0]).toMatchObject({ id: ids.egg, lastQuantity: 54, lastUnit: 'g' });
    expect(q.templates).toEqual([]);
    expect((await call(quickRoute, { jar: b.jar })).body).toEqual({ favorites: [], frequent: [], templates: [] });
    const s = (await call(searchRoute, { jar: a.jar, url: '/api/v1/foods?category=frutas' })).body.items[0];
    expect(s.isFavorite).toBe(true);
    await call(unfavRoute, { method: 'DELETE', jar: a.jar, params: { id: ids.mango! } });
    expect((await call(quickRoute, { jar: a.jar })).body.favorites).toEqual([]);
  });
});
