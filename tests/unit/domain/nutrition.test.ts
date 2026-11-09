import { describe, expect, it } from 'vitest';
import { scaleNutrients, sumNutrients } from '@/domain/nutrition';
import type { NutrientsPer100 } from '@/domain/types';

const egg: NutrientsPer100 = { kcal: 155, proteinG: 12.6, carbsG: 1.1, fatG: 10.6, fiberG: 0, sugarG: 1.1, sodiumMg: 124 };
const milk: NutrientsPer100 = { kcal: 61, proteinG: 3.2, carbsG: 4.8, fatG: 3.3, fiberG: null, sugarG: 5.1, sodiumMg: 43 };

describe('scaleNutrients', () => {
  it('100 g of a per-100 g food equals its reference values', () => {
    const r = scaleNutrients(egg, 100, 'g', 'g');
    expect(r.approximate).toBe(false);
    expect(r.nutrients).toEqual(egg);
  });

  it('219 kcal/100 g × 130 g → 284.7 kcal', () => {
    const r = scaleNutrients({ ...egg, kcal: 219 }, 130, 'g', 'g');
    expect(r.nutrients.kcal).toBeCloseTo(284.7, 9);
  });

  it('155 kcal/100 g × 130 g → 201.5 kcal (spec US2 scenario 2)', () => {
    expect(scaleNutrients(egg, 130, 'g', 'g').nutrients.kcal).toBeCloseTo(201.5, 9);
  });

  it('200 ml of a per-100 ml liquid → 122 kcal', () => {
    const r = scaleNutrients(milk, 200, 'ml', 'ml');
    expect(r.nutrients.kcal).toBeCloseTo(122, 9);
    expect(r.approximate).toBe(false);
  });

  it('ml entered for a per-100 g food without density assumes 1 g/ml and is approximate', () => {
    const r = scaleNutrients(milk, 200, 'ml', 'g');
    expect(r.nutrients.kcal).toBeCloseTo(122, 9);
    expect(r.approximate).toBe(true);
  });

  it('uses density in both directions', () => {
    // 200 ml × 1.03 g/ml = 206 g of a per-100 g food.
    expect(scaleNutrients(milk, 200, 'ml', 'g', 1.03).nutrients.kcal).toBeCloseTo(61 * 2.06, 9);
    // 103 g / 1.03 g/ml = 100 ml of a per-100 ml food.
    const r = scaleNutrients(milk, 103, 'g', 'ml', 1.03);
    expect(r.nutrients.kcal).toBeCloseTo(61, 9);
    expect(r.approximate).toBe(false);
  });

  it('keeps unknown optional nutrients as null, never zero', () => {
    expect(scaleNutrients(milk, 200, 'ml', 'ml').nutrients.fiberG).toBeNull();
    expect(scaleNutrients(egg, 50, 'g', 'g').nutrients.fiberG).toBe(0);
  });
});

describe('sumNutrients', () => {
  it('sums known values and reports incomplete optional nutrients', () => {
    const a = scaleNutrients(egg, 100, 'g', 'g').nutrients;
    const b = scaleNutrients(milk, 200, 'ml', 'ml').nutrients;
    const { totals, incomplete } = sumNutrients([a, b]);
    expect(totals.kcal).toBeCloseTo(155 + 122, 9);
    expect(totals.fiberG).toBe(0);
    expect(incomplete).toEqual(['fiber']);
    expect(totals.sugarG).toBeCloseTo(1.1 + 10.2, 9);
  });

  it('all-unknown optional nutrient sums to null', () => {
    const b = scaleNutrients(milk, 100, 'ml', 'ml').nutrients;
    expect(sumNutrients([b, b]).totals.fiberG).toBeNull();
  });

  it('empty list is all zero and complete', () => {
    expect(sumNutrients([])).toEqual({
      totals: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 },
      incomplete: [],
    });
  });
});
