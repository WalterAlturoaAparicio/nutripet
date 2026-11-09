import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { call, useFreshDb } from './helpers/db';
import { setupTwoProfiles } from './helpers/fixtures';
import { seedFoods } from './helpers/foods';
import { GET as searchRoute } from '@/app/api/v1/foods/route';
import { GET as foodRoute } from '@/app/api/v1/foods/[id]/route';
import { GET as variantsRoute } from '@/app/api/v1/foods/[id]/variants/route';
import { db } from '@/server/db/client';
import { food } from '@/server/db/schema';
import { newId } from '@/server/db/ids';

useFreshDb();

const search = (jar: Record<string, string>, qs: string) => call(searchRoute, { jar, url: `/api/v1/foods?${qs}` });

describe('food search', () => {
  it('is accent- and case-insensitive and matches aliases in Spanish and English', async () => {
    seedFoods();
    const { a } = await setupTwoProfiles();
    expect((await search(a.jar, 'q=PLATANO')).body.items[0].nameEs).toBe('Plátano maduro, crudo');
    expect((await search(a.jar, 'q=huevo')).body.items.map((f: any) => f.nameEs)).toEqual(
      expect.arrayContaining(['Huevo entero, cocido (duro)', 'Huevo entero, crudo']),
    );
    expect((await search(a.jar, 'q=egg')).body.items[0].nameEs).toBe('Huevo entero, cocido (duro)');
  });

  it('matches prefixes while typing and returns raw/cooked variants separately with their state', async () => {
    seedFoods();
    const { a } = await setupTwoProfiles();
    const r = await search(a.jar, 'q=ar');
    expect(r.body.items.map((f: any) => f.nameEs)).toEqual(expect.arrayContaining(['Arroz blanco, cocido', 'Arepa de maíz blanco']));
    const eggs = (await search(a.jar, 'q=huevo')).body.items;
    expect(new Set(eggs.map((f: any) => f.preparationState))).toEqual(new Set(['raw', 'cooked']));
  });

  it('filters by category, state and branded', async () => {
    seedFoods();
    const { a } = await setupTwoProfiles();
    expect((await search(a.jar, 'category=frutas')).body.items.map((f: any) => f.nameEs)).toEqual(['Mango, crudo']);
    expect((await search(a.jar, 'q=huevo&state=raw')).body.items.map((f: any) => f.nameEs)).toEqual(['Huevo entero, crudo']);
    const branded = (await search(a.jar, 'branded=true')).body.items;
    expect(branded).toHaveLength(1);
    expect(branded[0]).toMatchObject({ brand: 'Marca X', preparationState: 'packaged', source: 'off' });
  });

  it('excludes hidden foods and other profiles\' custom foods', async () => {
    const ids = seedFoods();
    const { a, b } = await setupTwoProfiles();
    db().update(food).set({ hiddenAt: new Date().toISOString() }).where(eq(food.id, ids.mango!)).run();
    expect((await search(a.jar, 'q=mango')).body.items).toHaveLength(0);
    const egg = db().select().from(food).where(eq(food.id, ids.egg!)).get()!;
    db().insert(food).values({ ...egg, id: newId(), sourceFoodId: null, dataSourceId: 'user', ownerProfileId: a.id, nameEs: 'Arepa de la abuela' }).run();
    expect((await search(a.jar, 'q=abuela')).body.items).toHaveLength(1);
    expect((await search(b.jar, 'q=abuela')).body.items).toHaveLength(0);
  });

  it('suggests a custom food instead of an unrelated one when nothing verified matches', async () => {
    seedFoods();
    const { a } = await setupTwoProfiles();
    const r = await search(a.jar, 'q=arepa%20casera');
    expect(r.body).toEqual({ items: [], suggestCustomFood: true });
  });

  it('returns food detail with source info and sibling variants', async () => {
    const ids = seedFoods();
    const { a } = await setupTwoProfiles();
    const d = await call(foodRoute, { jar: a.jar, params: { id: ids.milk! } });
    expect(d.body).toMatchObject({ nameEs: 'Leche entera', per100: { basis: 'ml', kcal: 61, fiberG: null, densityGPerMl: 1.03 }, source: { id: 'usda_fdc' } });
    const v = await call(variantsRoute, { jar: a.jar, params: { id: ids.egg! } });
    expect(v.body.map((f: any) => f.nameEs)).toEqual(['Huevo entero, crudo']);
  });
});
