import { describe, expect, it } from 'vitest';
import { validateFood } from '../../../scripts/importers/validate';
import type { NormalizedFood } from '../../../scripts/importers/normalized';

const base: NormalizedFood = {
  sourceFoodId: '1',
  nameEs: 'Arroz blanco, cocido',
  category: 'cereales',
  preparationState: 'cooked',
  basis: 'g',
  kcal: 130,
  proteinG: 2.7,
  carbsG: 28.2,
  fatG: 0.3,
  fiberG: 0.4,
  sugarG: 0.1,
  sodiumMg: 1,
  sourceVersion: 'test',
};

const errorsOf = (f: Partial<NormalizedFood>) => {
  const r = validateFood({ ...base, ...f });
  return r.ok ? [] : r.errors;
};

describe('validateFood', () => {
  it('accepts a consistent food without warnings', () => {
    expect(validateFood(base)).toEqual({ ok: true, warnings: [] });
  });

  it('rejects missing core nutrients', () => {
    expect(errorsOf({ proteinG: undefined as unknown as number })).toContain('missing core nutrient proteinG');
    expect(errorsOf({ kcal: NaN })).toContain('missing core nutrient kcal');
  });

  it('rejects negative values', () => {
    expect(errorsOf({ fatG: -1 })).toContain('negative fatG');
  });

  it('rejects kcal above 900 per 100', () => {
    expect(errorsOf({ kcal: 950, fatG: 99, carbsG: 0, proteinG: 0 })).toContain('kcal > 900 per 100');
  });

  it('rejects macronutrients above 100 g per 100 g (but not per 100 ml)', () => {
    expect(errorsOf({ proteinG: 50, carbsG: 50, fatG: 10, kcal: 490 })).toContain('protein + carbs + fat > 100 g per 100 g');
  });

  it('rejects sugar clearly above carbs, warns on small artifacts', () => {
    expect(errorsOf({ sugarG: 32, carbsG: 28.2 })).toContain('sugar > carbs');
    const milk = validateFood({ ...base, kcal: 61, proteinG: 3.2, carbsG: 4.8, fatG: 3.3, sugarG: 5.05, basis: 'ml' });
    expect(milk.ok).toBe(true);
    expect(milk.ok && milk.warnings[0]).toMatch(/slightly above carbs/);
  });

  it('warns (does not reject) on Atwater deviations', () => {
    const r = validateFood({ ...base, kcal: 228, proteinG: 19.6, carbsG: 57.9, fatG: 13.7 });
    expect(r.ok).toBe(true);
    expect(r.ok && r.warnings[0]).toMatch(/atwater deviation/);
  });

  it('validates density range and optional nutrients', () => {
    expect(errorsOf({ densityGPerMl: 5 })).toContain('density out of range 0.3–2.0');
    expect(errorsOf({ fiberG: -2 })).toContain('invalid fiberG');
    expect(errorsOf({ fiberG: null, sugarG: null, sodiumMg: null })).toEqual([]);
  });
});
