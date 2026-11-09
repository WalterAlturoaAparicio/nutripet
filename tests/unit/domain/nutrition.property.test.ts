import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { scaleNutrients, sumNutrients } from '@/domain/nutrition';
import type { NutrientsPer100 } from '@/domain/types';

const per100 = fc.record<NutrientsPer100>({
  kcal: fc.double({ min: 0, max: 900, noNaN: true }),
  proteinG: fc.double({ min: 0, max: 40, noNaN: true }),
  carbsG: fc.double({ min: 0, max: 40, noNaN: true }),
  fatG: fc.double({ min: 0, max: 20, noNaN: true }),
  fiberG: fc.option(fc.double({ min: 0, max: 30, noNaN: true }), { nil: null }),
  sugarG: fc.option(fc.double({ min: 0, max: 30, noNaN: true }), { nil: null }),
  sodiumMg: fc.option(fc.double({ min: 0, max: 5000, noNaN: true }), { nil: null }),
});
const qty = fc.double({ min: 0.1, max: 2000, noNaN: true });

describe('nutrient scaling properties', () => {
  it('is linear in quantity', () => {
    fc.assert(
      fc.property(per100, qty, fc.double({ min: 0.1, max: 10, noNaN: true }), (p, q, k) => {
        const a = scaleNutrients(p, q, 'g', 'g').nutrients.kcal * k;
        const b = scaleNutrients(p, q * k, 'g', 'g').nutrients.kcal;
        expect(b).toBeCloseTo(a, 6);
      }),
    );
  });

  it('splitting a quantity and summing equals scaling the total (within 1e-9)', () => {
    fc.assert(
      fc.property(per100, qty, fc.double({ min: 0.01, max: 0.99, noNaN: true }), (p, q, f) => {
        const whole = scaleNutrients(p, q, 'g', 'g').nutrients;
        const parts = sumNutrients([
          scaleNutrients(p, q * f, 'g', 'g').nutrients,
          scaleNutrients(p, q * (1 - f), 'g', 'g').nutrients,
        ]).totals;
        for (const key of ['kcal', 'proteinG', 'carbsG', 'fatG'] as const) {
          expect(Math.abs(parts[key] - whole[key])).toBeLessThan(1e-9 * Math.max(1, whole[key]));
        }
      }),
    );
  });
});
