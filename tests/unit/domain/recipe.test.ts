import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  computePreparation,
  ingredientContribution,
  NutritionError,
  portionFactor,
  portionNutrients,
  scaleNutrients,
  sumNutrients,
  type IngredientInput,
  type PreparationFacts,
} from '@/domain/nutrition';
import type { NutrientsPer100 } from '@/domain/types';

const per100 = (kcal: number, proteinG = 0, carbsG = 0, fatG = 0, extra: Partial<NutrientsPer100> = {}): NutrientsPer100 => ({
  kcal,
  proteinG,
  carbsG,
  fatG,
  fiberG: null,
  sugarG: null,
  sodiumMg: null,
  ...extra,
});

// References used across the cases (contracts/domain-calculations.md § preparations).
const lemonadePowder = (g: number): IngredientInput => ({ quantity: g, unit: 'g', basis: 'g', densityGPerMl: null, per100: per100(400, 0, 98, 0) });
const water = (ml: number): IngredientInput => ({
  quantity: ml,
  unit: 'ml',
  basis: 'ml',
  densityGPerMl: 1,
  per100: per100(0, 0, 0, 0, { fiberG: 0, sugarG: 0 }),
});
const milk = (ml: number): IngredientInput => ({ quantity: ml, unit: 'ml', basis: 'ml', densityGPerMl: 1.03, per100: per100(61, 3.2, 4.8, 3.3) });
const chocolatePowder = (g: number): IngredientInput => ({ quantity: g, unit: 'g', basis: 'g', densityGPerMl: null, per100: per100(380, 5, 85, 3) });
const oats = (g: number): IngredientInput => ({ quantity: g, unit: 'g', basis: 'g', densityGPerMl: null, per100: per100(379, 13.2, 67.7, 6.5) });
const banana = (g: number): IngredientInput => ({ quantity: g, unit: 'g', basis: 'g', densityGPerMl: null, per100: per100(89, 1.1, 22.8, 0.3) });

describe('ingredient contribution = (quantity / reference) × value per reference', () => {
  it('powder per 100 g: 20 g × 400 kcal/100 g = 80 kcal', () => {
    expect(ingredientContribution(lemonadePowder(20)).nutrients.kcal).toBeCloseTo(80, 9);
  });
  it('liquid per 100 ml: 200 ml of milk × 61 kcal/100 ml = 122 kcal', () => {
    const r = ingredientContribution(milk(200));
    expect(r.nutrients.kcal).toBeCloseTo(122, 9);
    expect(r.nutrients.proteinG).toBeCloseTo(6.4, 9);
  });
  it('water contributes zero energy and zero macronutrients', () => {
    const r = ingredientContribution(water(300)).nutrients;
    expect([r.kcal, r.proteinG, r.carbsG, r.fatG]).toEqual([0, 0, 0, 0]);
  });
  it('rejects invalid references and quantities instead of assuming zero', () => {
    const bad = (p: Partial<NutrientsPer100>) => ({ ...lemonadePowder(20), per100: { ...per100(400), ...p } });
    expect(() => ingredientContribution(bad({ kcal: Number.NaN }))).toThrow(NutritionError);
    expect(() => ingredientContribution(bad({ proteinG: -1 }))).toThrow(NutritionError);
    expect(() => ingredientContribution({ ...lemonadePowder(20), per100: undefined as unknown as NutrientsPer100 })).toThrow(NutritionError);
    expect(() => ingredientContribution(lemonadePowder(0))).toThrow(expect.objectContaining({ code: 'invalid_quantity' }));
    expect(() => ingredientContribution(lemonadePowder(-5))).toThrow(expect.objectContaining({ code: 'invalid_quantity' }));
  });
  it('reports the failing ingredient index', () => {
    try {
      computePreparation({ ingredients: [water(300), lemonadePowder(0)] });
      expect.unreachable();
    } catch (e) {
      expect(e).toMatchObject({ code: 'invalid_quantity', index: 1 });
    }
  });
});

describe('preparations (sum of ingredient contributions)', () => {
  it('lemonade: 20 g powder + 300 ml water = 80 kcal (water does not dilute the total)', () => {
    const r = computePreparation({ ingredients: [lemonadePowder(20), water(300)] });
    expect(r.totals.kcal).toBeCloseTo(80, 9);
    expect(r.totals.carbsG).toBeCloseTo(19.6, 9);
  });
  it('more water changes nothing in the total', () => {
    const a = computePreparation({ ingredients: [lemonadePowder(20), water(300)] }).totals;
    const b = computePreparation({ ingredients: [lemonadePowder(20), water(1000)] }).totals;
    expect(b).toEqual(a);
  });
  it('different powder quantities scale linearly', () => {
    expect(computePreparation({ ingredients: [lemonadePowder(10), water(300)] }).totals.kcal).toBeCloseTo(40, 9);
    expect(computePreparation({ ingredients: [lemonadePowder(35), water(300)] }).totals.kcal).toBeCloseTo(140, 9);
  });
  it('powder dissolved in milk adds the milk contribution: 20 g + 300 ml milk = 80 + 183 kcal', () => {
    const r = computePreparation({ ingredients: [lemonadePowder(20), milk(300)] });
    expect(r.totals.kcal).toBeCloseTo(80 + 183, 9);
    expect(r.totals.proteinG).toBeCloseTo(9.6, 9);
  });
  it('different liquid quantities: milk volume matters, water volume does not', () => {
    const k = (ing: IngredientInput[]) => computePreparation({ ingredients: ing }).totals.kcal;
    expect(k([chocolatePowder(25), milk(200)])).toBeCloseTo(95 + 122, 9);
    expect(k([chocolatePowder(25), milk(250)])).toBeCloseTo(95 + 152.5, 9);
    expect(k([chocolatePowder(25), water(200)])).toBeCloseTo(k([chocolatePowder(25), water(250)]), 9);
  });
  it('oatmeal with three ingredients', () => {
    const r = computePreparation({ ingredients: [oats(50), milk(200), banana(80)] });
    expect(r.totals.kcal).toBeCloseTo(189.5 + 122 + 71.2, 9);
    expect(r.totals.proteinG).toBeCloseTo(6.6 + 6.4 + 0.88, 9);
    expect(r.ingredients).toHaveLength(3);
  });
  it('totals equal sumNutrients of scaleNutrients per ingredient (same rule as meals)', () => {
    const ing = [oats(50), milk(200), banana(80)];
    const viaMeal = sumNutrients(ing.map((i) => scaleNutrients(i.per100, i.quantity, i.unit, i.basis, i.densityGPerMl).nutrients)).totals;
    expect(computePreparation({ ingredients: ing }).totals).toEqual(viaMeal);
  });
  it('per serving and per 100 of the entered final yield', () => {
    const r = computePreparation({ ingredients: [oats(50), milk(200), banana(80)], servings: 2, yield: { quantity: 400, unit: 'g' } });
    expect(r.perServing!.kcal).toBeCloseTo(r.totals.kcal / 2, 9);
    expect(r.per100OfYield!.kcal).toBeCloseTo(r.totals.kcal / 4, 9);
    expect(r.per100OfYield!.unit).toBe('g');
  });
  it('final yield different from the ingredient sum: per-100 uses the entered yield, totals unchanged', () => {
    // 50 g oats + 200 ml milk + 80 g banana "add up" to ~330, but cooking reduced it to 280 g.
    const cooked = computePreparation({ ingredients: [oats(50), milk(200), banana(80)], yield: { quantity: 280, unit: 'g' } });
    const raw = computePreparation({ ingredients: [oats(50), milk(200), banana(80)] });
    expect(cooked.totals).toEqual(raw.totals);
    expect(cooked.per100OfYield!.kcal).toBeCloseTo((raw.totals.kcal * 100) / 280, 9);
  });
  it('without an entered yield there are no per-100 values (never inferred from the ingredients)', () => {
    const r = computePreparation({ ingredients: [lemonadePowder(20), water(300)] });
    expect(r.per100OfYield).toBeNull();
    expect(r.perServing).toBeNull();
  });
  it('rejects empty preparations and invalid servings/yield', () => {
    expect(() => computePreparation({ ingredients: [] })).toThrow(expect.objectContaining({ code: 'no_ingredients' }));
    expect(() => computePreparation({ ingredients: [water(100)], servings: 0 })).toThrow(expect.objectContaining({ code: 'invalid_servings' }));
    expect(() => computePreparation({ ingredients: [water(100)], yield: { quantity: 0, unit: 'ml' } })).toThrow(
      expect.objectContaining({ code: 'invalid_yield' }),
    );
  });
  it('optional nutrients unknown in some ingredient are flagged incomplete; a g/ml conversion without density is approximate', () => {
    const noDensity: IngredientInput = { quantity: 100, unit: 'ml', basis: 'g', densityGPerMl: null, per100: per100(45) };
    const r = computePreparation({ ingredients: [water(100), noDensity] });
    expect(r.incomplete).toContain('fiber');
    expect(r.approximate).toBe(true);
  });
});

describe('portions of a preparation', () => {
  const lemonade: PreparationFacts = { totals: { kcal: 400, proteinG: 10, carbsG: 80, fatG: 4, fiberG: null, sugarG: 60, sodiumMg: null }, servings: 4, yield: { quantity: 500, unit: 'ml' }, homogeneous: true };

  it('entire preparation includes every ingredient contribution', () => {
    expect(portionNutrients(lemonade, { mode: 'whole' }).nutrients).toEqual(lemonade.totals);
  });
  it('partial by amount: 400 kcal × 200 / 500 ml = 160 kcal', () => {
    const r = portionNutrients(lemonade, { mode: 'amount', quantity: 200, unit: 'ml' });
    expect(r.factor).toBeCloseTo(0.4, 12);
    expect(r.nutrients.kcal).toBeCloseTo(160, 9);
    expect(r.nutrients.sugarG).toBeCloseTo(24, 9);
    expect(r.nutrients.fiberG).toBeNull();
  });
  it('multiple servings: 2 of 4 servings = half', () => {
    expect(portionNutrients(lemonade, { mode: 'servings', servings: 2 }).nutrients.kcal).toBeCloseTo(200, 9);
    expect(portionNutrients(lemonade, { mode: 'servings', servings: 1.5 }).nutrients.kcal).toBeCloseTo(150, 9);
  });
  it('amount needs a known yield in the same unit, and cannot exceed it', () => {
    const noYield = { ...lemonade, yield: null };
    expect(() => portionFactor(noYield, { mode: 'amount', quantity: 200, unit: 'ml' })).toThrow(expect.objectContaining({ code: 'yield_unknown' }));
    expect(() => portionFactor(lemonade, { mode: 'amount', quantity: 200, unit: 'g' })).toThrow(expect.objectContaining({ code: 'unit_mismatch' }));
    expect(() => portionFactor(lemonade, { mode: 'amount', quantity: 600, unit: 'ml' })).toThrow(expect.objectContaining({ code: 'portion_exceeds_total' }));
    expect(() => portionFactor(lemonade, { mode: 'amount', quantity: 0, unit: 'ml' })).toThrow(expect.objectContaining({ code: 'invalid_quantity' }));
  });
  it('servings need a defined number of servings and cannot exceed it', () => {
    expect(() => portionFactor({ ...lemonade, servings: null }, { mode: 'servings', servings: 1 })).toThrow(expect.objectContaining({ code: 'servings_unknown' }));
    expect(() => portionFactor(lemonade, { mode: 'servings', servings: 5 })).toThrow(expect.objectContaining({ code: 'portion_exceeds_total' }));
  });
  it('homogeneous vs non-homogeneous: proportional-by-amount only for homogeneous preparations', () => {
    const stew = { ...lemonade, homogeneous: false, yield: { quantity: 1200, unit: 'g' as const } };
    expect(() => portionFactor(stew, { mode: 'amount', quantity: 300, unit: 'g' })).toThrow(expect.objectContaining({ code: 'not_homogeneous' }));
    // Whole preparation and equal servings remain valid; otherwise the eaten ingredients are logged directly.
    expect(portionFactor(stew, { mode: 'whole' })).toBe(1);
    expect(portionFactor(stew, { mode: 'servings', servings: 1 })).toBeCloseTo(0.25, 12);
    expect(portionFactor({ ...stew, homogeneous: true }, { mode: 'amount', quantity: 300, unit: 'g' })).toBeCloseTo(0.25, 12);
  });
  it('a lemonade made with more water: same total, so a glass of the same volume has fewer kcal', () => {
    const totals = computePreparation({ ingredients: [lemonadePowder(20), water(300)] }).totals;
    const diluted = computePreparation({ ingredients: [lemonadePowder(20), water(800)] }).totals;
    const glass = (t: typeof totals, yieldMl: number) =>
      portionNutrients({ totals: t, servings: null, yield: { quantity: yieldMl, unit: 'ml' }, homogeneous: true }, { mode: 'amount', quantity: 200, unit: 'ml' }).nutrients.kcal;
    expect(glass(totals, 320)).toBeCloseTo(50, 9);
    expect(glass(diluted, 820)).toBeCloseTo((80 * 200) / 820, 9);
  });
  it('property: consuming the whole yield by amount equals the whole preparation; splitting into parts sums to the total', () => {
    fc.assert(
      fc.property(fc.double({ min: 1, max: 5000, noNaN: true }), fc.double({ min: 0, max: 900, noNaN: true }), fc.double({ min: 0.05, max: 0.95, noNaN: true }), (yieldMl, kcal, split) => {
        const facts: PreparationFacts = { totals: { kcal, proteinG: 0, carbsG: 0, fatG: 0, fiberG: null, sugarG: null, sodiumMg: null }, servings: null, yield: { quantity: yieldMl, unit: 'ml' }, homogeneous: true };
        const whole = portionNutrients(facts, { mode: 'amount', quantity: yieldMl, unit: 'ml' }).nutrients.kcal;
        const a = portionNutrients(facts, { mode: 'amount', quantity: yieldMl * split, unit: 'ml' }).nutrients.kcal;
        const b = portionNutrients(facts, { mode: 'amount', quantity: yieldMl * (1 - split), unit: 'ml' }).nutrients.kcal;
        return Math.abs(whole - kcal) < 1e-9 * Math.max(1, kcal) && Math.abs(a + b - kcal) < 1e-9 * Math.max(1, kcal);
      }),
    );
  });
});
