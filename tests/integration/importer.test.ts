import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { useFreshDb } from './helpers/db';
import { runImport } from '../../scripts/importers/pipeline';
import { normalizeOffProduct } from '../../scripts/importers/off';
import { normalizeFdcFood } from '../../scripts/importers/usda';
import type { AdapterResult, NormalizedFood } from '../../scripts/importers/normalized';
import { db } from '@/server/db/client';
import { food, foodAlias, foodVersion, importRun } from '@/server/db/schema';

useFreshDb();

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'np-import-'));
function fixtureFile(name: string, content: string): string {
  const f = path.join(tmp, name);
  fs.writeFileSync(f, content);
  return f;
}

const rice: NormalizedFood = {
  sourceFoodId: '168878',
  nameEs: 'Arroz blanco, cocido',
  nameEn: 'Rice, white, cooked',
  aliases: [{ alias: 'arroz', lang: 'es' }],
  category: 'cereales',
  preparationState: 'cooked',
  basis: 'g',
  kcal: 130,
  proteinG: 2.69,
  carbsG: 28.2,
  fatG: 0.28,
  fiberG: 0.4,
  sugarG: 0.05,
  sodiumMg: 1,
  sourceVersion: 'SR Legacy 2018-04',
};

const input = (foods: NormalizedFood[], file = fixtureFile('a.json', JSON.stringify(foods))): AdapterResult => ({
  sourceVersion: 'fixture',
  inputFiles: [file],
  foods,
  skipped: [],
});

describe('import pipeline', () => {
  it('creates foods with v1, then an identical rerun changes nothing', () => {
    const r1 = runImport('usda_fdc', input([rice]), { reportDir: tmp });
    expect(r1).toMatchObject({ created: 1, updated: 0, unchanged: 0 });
    const f = db().select().from(food).where(eq(food.sourceFoodId, '168878')).get()!;
    const v = db().select().from(foodVersion).where(eq(foodVersion.foodId, f.id)).all();
    expect(v).toHaveLength(1);
    expect(f.currentVersionId).toBe(v[0]!.id);

    const r2 = runImport('usda_fdc', input([rice]), { reportDir: tmp });
    expect(r2).toMatchObject({ created: 0, updated: 0, unchanged: 1 });
    expect(db().select().from(foodVersion).all()).toHaveLength(1);
  });

  it('a nutrient change creates a new version and moves current_version_id', () => {
    runImport('usda_fdc', input([rice]), { reportDir: null });
    const r = runImport('usda_fdc', input([{ ...rice, kcal: 135 }]), { reportDir: null });
    expect(r).toMatchObject({ created: 0, updated: 1 });
    const f = db().select().from(food).get()!;
    const versions = db().select().from(foodVersion).where(eq(foodVersion.foodId, f.id)).all();
    expect(versions.map((v) => v.versionNo).sort()).toEqual([1, 2]);
    expect(versions.find((v) => v.id === f.currentVersionId)!.kcal).toBe(135);
    expect(versions.find((v) => v.versionNo === 1)!.kcal).toBe(130);
  });

  it('alias or name changes update the food without a new version', () => {
    runImport('usda_fdc', input([rice]), { reportDir: null });
    const r = runImport('usda_fdc', input([{ ...rice, nameEs: 'Arroz blanco grano largo, cocido', aliases: [{ alias: 'arroz cocido', lang: 'es' }] }]), {
      reportDir: null,
    });
    expect(r.updated).toBe(1);
    expect(db().select().from(foodVersion).all()).toHaveLength(1);
    expect(db().select().from(foodAlias).all().map((a) => a.alias)).toEqual(['arroz cocido']);
  });

  it('records the import run with a checksum and writes a report', () => {
    const r = runImport('usda_fdc', input([rice]), { reportDir: tmp });
    const run = db().select().from(importRun).where(eq(importRun.id, r.importRunId!)).get()!;
    expect(run).toMatchObject({ status: 'ok', created: 1, inputChecksum: r.checksum });
    expect(run.inputChecksum).toMatch(/^[0-9a-f]{64}$/);
    expect(fs.existsSync(r.reportPath!)).toBe(true);
  });

  it('rejects invalid rows (never fixes them) and dry runs write nothing', () => {
    const bad = { ...rice, sourceFoodId: 'bad', kcal: -5 };
    const dry = runImport('usda_fdc', input([rice, bad]), { dryRun: true, reportDir: null });
    expect(dry).toMatchObject({ created: 1, skipped: 1 });
    expect(dry.rejected[0]!.errors).toContain('negative kcal');
    expect(db().select().from(food).all()).toHaveLength(0);
    expect(db().select().from(importRun).all()).toHaveLength(0);
  });

  it('a fixture adapter result imports through the same pipeline (extensibility)', () => {
    const custom: AdapterResult = { ...input([{ ...rice, sourceFoodId: 'X-1' }]), sourceVersion: 'any-source v1' };
    expect(runImport('tcac', custom, { reportDir: null }).created).toBe(1);
    expect(db().select().from(food).get()!.dataSourceId).toBe('tcac');
  });
});

describe('source adapters', () => {
  it('USDA: picks energy fallbacks and converts ml-basis foods with density', () => {
    const fdc = {
      fdcId: 746782,
      description: 'Milk, whole',
      foodNutrients: [
        { nutrient: { id: 2047, unitName: 'kcal' }, amount: 60 },
        { nutrient: { id: 1003, unitName: 'g' }, amount: 3.3 },
        { nutrient: { id: 1005, unitName: 'g' }, amount: 4.6 },
        { nutrient: { id: 1004, unitName: 'g' }, amount: 3.2 },
        { nutrient: { id: 1093, unitName: 'mg' }, amount: 38 },
      ],
    };
    const row = { name_es: 'Leche entera', aliases_es: 'leche', category: 'lacteos', preparation_state: 'prepared', basis: 'ml', density_g_per_ml: '1.03' };
    const { food: f } = normalizeFdcFood(fdc, row, 'FDC test');
    expect(f!.basis).toBe('ml');
    expect(f!.kcal).toBeCloseTo(61.8, 9);
    expect(f!.fiberG).toBeNull();
    expect(f!.sodiumMg).toBeCloseTo(39.14, 9);
    expect(f!.aliases).toContainEqual({ alias: 'Milk, whole', lang: 'en' });
  });

  it('USDA: FNDDS rows land under usda_fndds', () => {
    const r = runImport('usda_fndds', input([{ ...rice, sourceFoodId: '2708408' }]), { reportDir: null });
    expect(r.created).toBe(1);
    expect(db().select().from(food).get()!.dataSourceId).toBe('usda_fndds');
  });

  it('OFF: keeps the published name and brand, packaged state, sodium g→mg, ml basis for liquids', () => {
    const { food: f } = normalizeOffProduct(
      {
        code: '7702001',
        product_name: 'Arepa de maíz blanco',
        brands: 'Marca X, Otra',
        quantity: '500 g',
        categories_tags: ['en:breads', 'en:arepas'],
        nutriments: { 'energy-kcal_100g': 200, proteins_100g: 4, carbohydrates_100g: 40, fat_100g: 2, sodium_100g: 0.3 },
      },
      'OFF 2026-11-08',
    );
    expect(f).toMatchObject({ nameEs: 'Arepa de maíz blanco', brand: 'Marca X', preparationState: 'packaged', basis: 'g', category: 'cereales' });
    expect(f!.sodiumMg).toBeCloseTo(300, 9);
    expect(f!.fiberG).toBeNull();

    const drink = normalizeOffProduct(
      { code: '2', product_name: 'Jugo', quantity: '1 l', nutriments: { energy_100g: 200, proteins_100g: 0, carbohydrates_100g: 11, fat_100g: 0 } },
      'OFF',
    ).food!;
    expect(drink.basis).toBe('ml');
    expect(drink.kcal).toBeCloseTo(200 / 4.184, 9);
    expect(normalizeOffProduct({ code: '3', product_name: 'Sin datos', nutriments: {} }, 'OFF').reason).toBe('missing core nutrient per 100');
  });
});
