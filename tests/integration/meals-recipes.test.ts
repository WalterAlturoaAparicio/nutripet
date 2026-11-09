import { describe, expect, it } from 'vitest';
import { call, setToday, type Jar, useFreshDb } from './helpers/db';
import { createOne, setupTwoProfiles } from './helpers/fixtures';
import { FIXTURE_FOODS, importFoods, seedFoods } from './helpers/foods';
import { POST as batchRoute } from '@/app/api/v1/days/[date]/entries/batch/route';
import { GET as dayRoute } from '@/app/api/v1/days/[date]/route';
import { PATCH as patchEntryRoute } from '@/app/api/v1/entries/[id]/route';
import { PUT as putMealRoute } from '@/app/api/v1/meals/[mealId]/route';
import { POST as duplicateRoute } from '@/app/api/v1/meals/[mealId]/duplicate/route';
import { GET as listRecipesRoute, POST as createRecipeRoute } from '@/app/api/v1/recipes/route';
import { DELETE as deleteRecipeRoute, GET as getRecipeRoute, PUT as putRecipeRoute } from '@/app/api/v1/recipes/[id]/route';
import { POST as templatesRoute } from '@/app/api/v1/templates/route';
import { POST as applyRoute } from '@/app/api/v1/templates/[id]/apply/route';
import { GET as searchRoute, POST as customFoodRoute } from '@/app/api/v1/foods/route';
import { GET as calendarRoute } from '@/app/api/v1/calendar/route';

useFreshDb();

const DATE = '2026-11-08';
const batch = (jar: Jar, body: Record<string, unknown>, date = DATE) => call(batchRoute, { body, jar, params: { date } });
const day = async (jar: Jar, date = DATE) => (await call(dayRoute, { jar, params: { date } })).body;
const putMeal = (jar: Jar, mealId: string, body: Record<string, unknown>) => call(putMealRoute, { method: 'PUT', jar, params: { mealId }, body });
const createRecipe = (jar: Jar, body: Record<string, unknown>) => call(createRecipeRoute, { body, jar });

async function waterId(jar: Jar): Promise<string> {
  const r = await call(searchRoute, { jar, url: '/api/v1/foods?q=agua' });
  const w = r.body.items.find((f: { nameEs: string }) => f.nameEs === 'Agua');
  expect(w).toBeDefined();
  return w.id;
}

async function lemonadePowder(jar: Jar): Promise<string> {
  const r = await call(customFoodRoute, {
    jar,
    body: {
      nameEs: 'Refresco en polvo sabor limón',
      category: 'bebidas',
      preparationState: 'packaged',
      productForm: 'dry_mix',
      preparationInstructions: '1 sobre (20 g) en 1 litro de agua.',
      sourceNote: 'Etiqueta del empaque',
      basis: 'g',
      kcal: 400,
      proteinG: 0,
      carbsG: 98,
      fatG: 0,
    },
  });
  expect(r.status).toBe(201);
  expect(r.body.productForm).toBe('dry_mix');
  return r.body.id;
}

describe('multi-ingredient meals', () => {
  it('saves a whole breakfast at once; per-item and meal totals; dashboard totals and calendar count', async () => {
    setToday(DATE);
    const ids = seedFoods();
    const a = await createOne();
    const r = await batch(a.jar, {
      occasion: 'breakfast',
      items: [
        { foodId: ids.egg, quantity: 100, unit: 'g' },
        { foodId: ids.oats, quantity: 60, unit: 'g' },
        { foodId: ids.milk, quantity: 200, unit: 'ml' },
      ],
    });
    expect(r.status).toBe(201);
    expect(r.body.entries).toHaveLength(3);
    const meal = r.body.day.meals[0];
    expect(meal.entries.map((e: { name: string }) => e.name)).toEqual(['Huevo entero, cocido (duro)', 'Avena en hojuelas, seca', 'Leche entera']);
    const kcal = 155 + 0.6 * 379 + 2 * 61;
    expect(meal.totals.kcal).toBeCloseTo(kcal, 9);
    expect(r.body.day.totals.kcal).toBeCloseTo(kcal, 9);
    expect(r.body.day.target.remainingKcal).toBeCloseTo(r.body.day.target.activeKcal - kcal, 9);
    // Energy balance (expenditure − intake, positive = deficit) uses the same intake total.
    expect(r.body.day.estimates.balanceKcal).toBeCloseTo(r.body.day.estimates.expenditureKcal - kcal, 6);
    const cal = await call(calendarRoute, { jar: a.jar, url: '/api/v1/calendar?month=2026-11' });
    expect(cal.status).toBe(200);
    expect(JSON.stringify(cal.body)).toContain(DATE);
  });

  it('rejects zero/negative quantities and saves nothing when any item is invalid', async () => {
    setToday(DATE);
    const ids = seedFoods();
    const a = await createOne();
    for (const quantity of [0, -10]) {
      const r = await batch(a.jar, { occasion: 'lunch', items: [{ foodId: ids.egg, quantity: 100, unit: 'g' }, { foodId: ids.oats, quantity, unit: 'g' }] });
      expect(r.status).toBe(422);
    }
    const unknown = await batch(a.jar, { occasion: 'lunch', items: [{ foodId: ids.egg, quantity: 100, unit: 'g' }, { foodId: 'nope', quantity: 10, unit: 'g' }] });
    expect(unknown.status).toBe(404);
    expect((await day(a.jar)).meals).toHaveLength(0);
  });

  it('edits an existing meal in one save: change a quantity, remove one, add one; kept items keep their snapshot', async () => {
    setToday(DATE);
    const ids = seedFoods();
    const a = await createOne();
    const r = await batch(a.jar, {
      occasion: 'lunch',
      items: [
        { foodId: ids.riceCooked, quantity: 150, unit: 'g' },
        { foodId: ids.egg, quantity: 50, unit: 'g' },
      ],
    });
    const [rice, egg] = r.body.entries;
    // The catalog changes after logging: the kept rice entry must still use 130 kcal/100 g.
    importFoods('usda_fdc', [{ ...FIXTURE_FOODS.riceCooked!, kcal: 200 }]);
    const saved = await putMeal(a.jar, r.body.mealId, {
      items: [
        { entryId: rice.id, quantity: 200, unit: 'g' },
        { foodId: ids.mango, quantity: 100, unit: 'g' },
      ],
    });
    expect(saved.status).toBe(200);
    const meal = saved.body.day.meals[0];
    expect(meal.entries.map((e: { id: string }) => e.id)).not.toContain(egg.id);
    const riceAfter = meal.entries.find((e: { id: string }) => e.id === rice.id);
    expect(riceAfter.quantity).toBe(200);
    expect(riceAfter.nutrients.kcal).toBeCloseTo(260, 9);
    expect(meal.totals.kcal).toBeCloseTo(260 + 60, 9);
    // An entry from another meal cannot be moved in through this endpoint.
    const other = await batch(a.jar, { occasion: 'dinner', items: [{ foodId: ids.egg, quantity: 10, unit: 'g' }] });
    const bad = await putMeal(a.jar, r.body.mealId, { items: [{ entryId: other.body.entries[0].id, quantity: 1, unit: 'g' }] });
    expect(bad.status).toBe(404);
  });

  it("another profile cannot edit the meal", async () => {
    setToday(DATE);
    const ids = seedFoods();
    const { a, b } = await setupTwoProfiles();
    const r = await batch(a.jar, { occasion: 'lunch', items: [{ foodId: ids.egg, quantity: 50, unit: 'g' }] });
    const res = await putMeal(b.jar, r.body.mealId, { items: [{ foodId: ids.egg, quantity: 50, unit: 'g' }] });
    expect(res.status).toBe(404);
  });

  it('saves a multi-food meal as a template and reuses it', async () => {
    setToday(DATE);
    const ids = seedFoods();
    const a = await createOne();
    const t = await call(templatesRoute, {
      jar: a.jar,
      body: { name: 'Desayuno usual', items: [{ foodId: ids.egg, quantity: 100, unit: 'g' }, { foodId: ids.milk, quantity: 200, unit: 'ml' }] },
    });
    expect(t.status).toBe(201);
    expect(t.body.items).toHaveLength(2);
    const applied = await call(applyRoute, { jar: a.jar, params: { id: t.body.id }, body: { date: DATE, occasion: 'breakfast' } });
    expect(applied.status).toBe(201);
    expect(applied.body.day.meals[0].totals.kcal).toBeCloseTo(155 + 122, 9);
  });
});

describe('preparations (recipes)', () => {
  it('water is available, contributes 0 kcal, and is not duplicated by re-seeding', async () => {
    setToday(DATE);
    const a = await createOne();
    const w = await call(searchRoute, { jar: a.jar, url: '/api/v1/foods?q=agua' });
    const waters = w.body.items.filter((f: { nameEs: string }) => f.nameEs === 'Agua');
    expect(waters).toHaveLength(1);
    expect(waters[0]).toMatchObject({ basis: 'ml', kcalPer100: 0, proteinPer100: 0, carbsPer100: 0, fatPer100: 0, source: 'reference' });
    // Milk is a liquid with its own values: never treated as zero.
    const ids = seedFoods();
    const r = await createRecipe(a.jar, { name: 'Leche', ingredients: [{ foodId: ids.milk, quantity: 200, unit: 'ml' }] });
    expect(r.body.totals.kcal).toBeCloseTo(122, 9);
  });

  it('lemonade: 20 g powder (400 kcal/100 g) + 300 ml water = 80 kcal total; a 200 ml glass of 320 ml = 50 kcal', async () => {
    setToday(DATE);
    const a = await createOne();
    const powder = await lemonadePowder(a.jar);
    const water = await waterId(a.jar);
    const r = await createRecipe(a.jar, {
      name: 'Limonada casera',
      ingredients: [
        { foodId: powder, quantity: 20, unit: 'g' },
        { foodId: water, quantity: 300, unit: 'ml' },
      ],
      yieldQuantity: 320,
      yieldUnit: 'ml',
      servings: 2,
      homogeneous: true,
    });
    expect(r.status).toBe(201);
    expect(r.body.totals.kcal).toBeCloseTo(80, 9);
    expect(r.body.ingredients[0]).toMatchObject({ productForm: 'dry_mix', quantity: 20, unit: 'g' });
    expect(r.body.ingredients[1].nutrients.kcal).toBe(0);
    expect(r.body.perServing.kcal).toBeCloseTo(40, 9);
    expect(r.body.per100OfYield).toMatchObject({ unit: 'ml' });
    expect(r.body.per100OfYield.kcal).toBeCloseTo(25, 9);

    const glass = await batch(a.jar, { occasion: 'afternoon_snack', items: [{ recipeId: r.body.id, portion: { mode: 'amount', quantity: 200, unit: 'ml' } }] });
    expect(glass.status).toBe(201);
    const e = glass.body.entries[0];
    expect(e).toMatchObject({ kind: 'recipe', name: 'Limonada casera', quantity: 200, unit: 'ml', foodId: null });
    expect(e.nutrients.kcal).toBeCloseTo(50, 9);
    expect(e.recipe.portion.factor).toBeCloseTo(200 / 320, 12);
    expect(glass.body.day.totals.kcal).toBeCloseTo(50, 9);
  });

  it('whole preparation vs servings; a different liquid (milk) adds its own energy', async () => {
    setToday(DATE);
    const ids = seedFoods();
    const a = await createOne();
    const powder = await lemonadePowder(a.jar);
    const r = await createRecipe(a.jar, {
      name: 'Bebida con leche',
      servings: 3,
      ingredients: [
        { foodId: powder, quantity: 20, unit: 'g' },
        { foodId: ids.milk, quantity: 300, unit: 'ml' },
      ],
    });
    const total = 80 + 183;
    expect(r.body.totals.kcal).toBeCloseTo(total, 9);
    const res = await batch(a.jar, {
      occasion: 'breakfast',
      items: [
        { recipeId: r.body.id, portion: { mode: 'whole' } },
        { recipeId: r.body.id, portion: { mode: 'servings', servings: 2 } },
      ],
    });
    expect(res.status).toBe(201);
    const [whole, two] = res.body.entries;
    expect(whole.nutrients.kcal).toBeCloseTo(total, 9);
    expect(whole.quantity).toBeNull(); // no yield entered → consumed volume unknown, never guessed
    expect(two.nutrients.kcal).toBeCloseTo((total * 2) / 3, 9);
    // Amount needs the actual final yield.
    const noYield = await batch(a.jar, { occasion: 'lunch', items: [{ recipeId: r.body.id, portion: { mode: 'amount', quantity: 100, unit: 'ml' } }] });
    expect(noYield.status).toBe(422);
    expect(noYield.body.error.reason).toBe('yield_unknown');
  });

  it('non-homogeneous preparations reject proportional-by-amount portions', async () => {
    setToday(DATE);
    const ids = seedFoods();
    const a = await createOne();
    const r = await createRecipe(a.jar, {
      name: 'Arroz con huevo',
      homogeneous: false,
      yieldQuantity: 400,
      yieldUnit: 'g',
      ingredients: [
        { foodId: ids.riceCooked, quantity: 300, unit: 'g' },
        { foodId: ids.egg, quantity: 100, unit: 'g' },
      ],
    });
    const res = await batch(a.jar, { occasion: 'lunch', items: [{ recipeId: r.body.id, portion: { mode: 'amount', quantity: 200, unit: 'g' } }] });
    expect(res.status).toBe(422);
    expect(res.body.error.reason).toBe('not_homogeneous');
    // Registering the ingredients actually eaten works as ordinary food items.
    const eaten = await batch(a.jar, { occasion: 'lunch', items: [{ foodId: ids.riceCooked, quantity: 200, unit: 'g' }, { foodId: ids.egg, quantity: 25, unit: 'g' }] });
    expect(eaten.body.day.totals.kcal).toBeCloseTo(260 + 38.75, 9);
  });

  it('validates recipes: no ingredients, zero quantity, yield without unit, portion larger than the preparation', async () => {
    setToday(DATE);
    const ids = seedFoods();
    const a = await createOne();
    expect((await createRecipe(a.jar, { name: 'X', ingredients: [] })).status).toBe(422);
    expect((await createRecipe(a.jar, { name: 'X', ingredients: [{ foodId: ids.oats, quantity: 0, unit: 'g' }] })).status).toBe(422);
    expect((await createRecipe(a.jar, { name: 'X', yieldQuantity: 100, ingredients: [{ foodId: ids.oats, quantity: 10, unit: 'g' }] })).status).toBe(422);
    const r = await createRecipe(a.jar, { name: 'Avena', yieldQuantity: 250, yieldUnit: 'g', ingredients: [{ foodId: ids.oats, quantity: 50, unit: 'g' }] });
    const tooMuch = await batch(a.jar, { occasion: 'breakfast', items: [{ recipeId: r.body.id, portion: { mode: 'amount', quantity: 300, unit: 'g' } }] });
    expect(tooMuch.status).toBe(422);
    expect(tooMuch.body.error.reason).toBe('portion_exceeds_total');
  });

  it("recipes are private to their profile", async () => {
    setToday(DATE);
    const ids = seedFoods();
    const { a, b } = await setupTwoProfiles();
    const r = await createRecipe(a.jar, { name: 'Avena', ingredients: [{ foodId: ids.oats, quantity: 50, unit: 'g' }] });
    expect((await call(getRecipeRoute, { jar: b.jar, params: { id: r.body.id } })).status).toBe(404);
    expect((await batch(b.jar, { occasion: 'breakfast', items: [{ recipeId: r.body.id, portion: { mode: 'whole' } }] })).status).toBe(404);
    expect((await call(listRecipesRoute, { jar: b.jar })).body).toHaveLength(0);
  });
});

describe('historical integrity', () => {
  async function oatmeal(jar: Jar, ids: Record<string, string>) {
    return createRecipe(jar, {
      name: 'Avena con leche',
      servings: 2,
      yieldQuantity: 300,
      yieldUnit: 'g',
      ingredients: [
        { foodId: ids.oats, quantity: 50, unit: 'g' },
        { foodId: ids.milk, quantity: 200, unit: 'ml' },
      ],
    });
  }

  it('updating a saved recipe does not change meals already registered; re-editing the old portion uses the old version', async () => {
    setToday(DATE);
    const ids = seedFoods();
    const a = await createOne();
    const r = await oatmeal(a.jar, ids);
    const v1Total = 189.5 + 122;
    const logged = await batch(a.jar, { occasion: 'breakfast', items: [{ recipeId: r.body.id, portion: { mode: 'servings', servings: 1 } }] });
    const entry = logged.body.entries[0];
    expect(entry.nutrients.kcal).toBeCloseTo(v1Total / 2, 9);

    const updated = await call(putRecipeRoute, {
      method: 'PUT',
      jar: a.jar,
      params: { id: r.body.id },
      body: { name: 'Avena con leche', servings: 2, yieldQuantity: 300, yieldUnit: 'g', ingredients: [{ foodId: ids.oats, quantity: 80, unit: 'g' }, { foodId: ids.milk, quantity: 200, unit: 'ml' }] },
    });
    expect(updated.body.versionNo).toBe(2);
    const v2Total = 0.8 * 379 + 122;
    expect(updated.body.totals.kcal).toBeCloseTo(v2Total, 9);

    const d = await day(a.jar);
    expect(d.meals[0].entries[0].nutrients.kcal).toBeCloseTo(v1Total / 2, 9);
    // Editing the logged portion recomputes from the version it was logged with (v1), not v2.
    const patched = await call(patchEntryRoute, { method: 'PATCH', jar: a.jar, params: { id: entry.id }, body: { portion: { mode: 'servings', servings: 2 } } });
    expect(patched.status).toBe(200);
    expect(patched.body.entry.nutrients.kcal).toBeCloseTo(v1Total, 9);
    expect(patched.body.entry.recipe.recipeVersionId).toBe(entry.recipe.recipeVersionId);
    // The exact version stays readable, even after the recipe is deleted.
    expect((await call(deleteRecipeRoute, { method: 'DELETE', jar: a.jar, params: { id: r.body.id } })).status).toBe(204);
    const old = await call(getRecipeRoute, { jar: a.jar, params: { id: r.body.id }, url: `/api/v1/recipes/${r.body.id}?versionId=${entry.recipe.recipeVersionId}` });
    expect(old.status).toBe(200);
    expect(old.body.versionNo).toBe(1);
    expect(old.body.totals.kcal).toBeCloseTo(v1Total, 9);
    expect((await call(listRecipesRoute, { jar: a.jar })).body).toHaveLength(0);
  });

  it('updating the catalog food changes neither the saved recipe version nor meals that used it', async () => {
    setToday(DATE);
    const ids = seedFoods();
    const a = await createOne();
    const r = await oatmeal(a.jar, ids);
    const logged = await batch(a.jar, { occasion: 'breakfast', items: [{ recipeId: r.body.id, portion: { mode: 'whole' } }] });
    importFoods('usda_fdc', [{ ...FIXTURE_FOODS.oats!, kcal: 500 }]);
    const again = await call(getRecipeRoute, { jar: a.jar, params: { id: r.body.id } });
    expect(again.body.totals.kcal).toBeCloseTo(189.5 + 122, 9);
    expect(again.body.ingredients[0].per100.kcal).toBe(379);
    expect((await day(a.jar)).meals[0].entries[0].nutrients.kcal).toBeCloseTo(logged.body.entries[0].nutrients.kcal, 9);
    // A new version (re-save) picks up the new catalog values.
    const resaved = await call(putRecipeRoute, {
      method: 'PUT',
      jar: a.jar,
      params: { id: r.body.id },
      body: { name: 'Avena con leche', ingredients: [{ foodId: ids.oats, quantity: 50, unit: 'g' }, { foodId: ids.milk, quantity: 200, unit: 'ml' }] },
    });
    expect(resaved.body.totals.kcal).toBeCloseTo(250 + 122, 9);
  });

  it('templates and duplicates with preparations use the current recipe version for the new meal only', async () => {
    setToday(DATE);
    const ids = seedFoods();
    const a = await createOne();
    const r = await oatmeal(a.jar, ids);
    const logged = await batch(a.jar, {
      occasion: 'breakfast',
      items: [
        { recipeId: r.body.id, portion: { mode: 'amount', quantity: 150, unit: 'g' } },
        { foodId: ids.mango, quantity: 70, unit: 'g' },
      ],
    });
    const t = await call(templatesRoute, { jar: a.jar, body: { name: 'Avena y mango', fromMealId: logged.body.mealId } });
    expect(t.status).toBe(201);
    expect(t.body.items[0]).toMatchObject({ kind: 'recipe', portion: { mode: 'amount', quantity: 150, unit: 'g' } });
    const dup = await call(duplicateRoute, { jar: a.jar, params: { mealId: logged.body.mealId }, body: { toDate: DATE, toOccasion: 'dinner' } });
    expect(dup.status).toBe(201);
    expect(dup.body.entries[0].nutrients.kcal).toBeCloseTo(logged.body.entries[0].nutrients.kcal, 9);
    const applied = await call(applyRoute, { jar: a.jar, params: { id: t.body.id }, body: { date: DATE, occasion: 'lunch' } });
    expect(applied.status).toBe(201);
    expect(applied.body.day.meals).toHaveLength(3);
  });
});
