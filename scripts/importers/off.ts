/**
 * Open Food Facts adapter (T055). Reads a dated snapshot written by `pnpm fetch:off`.
 * Scope: packaged/branded products only. Names are kept as published and never relabeled as homemade dishes.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { FoodCategory } from '../../src/server/db/schema/foods';
import type { AdapterResult, NormalizedFood } from './normalized';

export interface OffProduct {
  code: string;
  product_name?: string;
  product_name_es?: string;
  brands?: string;
  quantity?: string;
  nutrition_data_per?: string;
  categories_tags?: string[];
  nutriments?: Record<string, number | string | undefined>;
}

const CATEGORY_MAP: [RegExp, FoodCategory][] = [
  [/beverages|bebidas|drinks|sodas|juices|jugos|waters/, 'bebidas'],
  [/dairies|dairy|milks|cheeses|yogurts|lacteos/, 'lacteos'],
  [/cereals|breads|pastas|flours|harinas|breakfast-cereals|arepas|crackers|biscuits/, 'cereales'],
  [/meats|sausages|hams|embutidos/, 'carnes'],
  [/fishes|seafood|tunas|sardines/, 'pescados'],
  [/legumes|beans|lentils/, 'leguminosas'],
  [/fats|oils|butters|margarines/, 'grasas'],
  [/sweets|snacks-sweet|chocolates|candies|sugars|confectioneries|desserts/, 'azucares'],
  [/fruits/, 'frutas'],
  [/vegetables/, 'verduras'],
];

function category(tags: string[] = []): FoodCategory {
  const joined = tags.join(' ');
  for (const [re, cat] of CATEGORY_MAP) if (re.test(joined)) return cat;
  return 'empacados';
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

export function normalizeOffProduct(p: OffProduct, sourceVersion: string): { food?: NormalizedFood; reason?: string } {
  const name = (p.product_name_es || p.product_name || '').trim();
  if (!name) return { reason: 'missing product name' };
  const n = p.nutriments ?? {};
  const kcal = num(n['energy-kcal_100g']) ?? (num(n['energy_100g']) !== null ? num(n['energy_100g'])! / 4.184 : null);
  const protein = num(n['proteins_100g']);
  const carbs = num(n['carbohydrates_100g']);
  const fat = num(n['fat_100g']);
  if (kcal === null || protein === null || carbs === null || fat === null) return { reason: 'missing core nutrient per 100' };
  const sodiumG = num(n['sodium_100g']);
  const perMl = /100\s*ml/i.test(p.nutrition_data_per ?? '') || /\b\d+([.,]\d+)?\s*(ml|l|cl)\b/i.test(p.quantity ?? '');
  return {
    food: {
      sourceFoodId: p.code,
      nameEs: name,
      nameEn: p.product_name && p.product_name !== name ? p.product_name : null,
      aliases: [],
      category: category(p.categories_tags),
      preparationState: 'packaged',
      brand: p.brands?.split(',')[0]?.trim() || null,
      basis: perMl ? 'ml' : 'g',
      kcal,
      proteinG: protein,
      carbsG: carbs,
      fatG: fat,
      fiberG: num(n['fiber_100g']),
      sugarG: num(n['sugars_100g']),
      sodiumMg: sodiumG === null ? null : sodiumG * 1000,
      densityGPerMl: null,
      sourceVersion,
    },
  };
}

export function latestOffSnapshot(dir = path.resolve('data/sources/off')): string | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => /^snapshot-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort();
  return files.length ? path.join(dir, files.at(-1)!) : null;
}

export function loadOff(input?: string): AdapterResult {
  const file = input ?? latestOffSnapshot();
  if (!file || !fs.existsSync(file)) throw new Error('No hay snapshot de Open Food Facts. Ejecuta primero: pnpm fetch:off');
  const date = path.basename(file).match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? 'unknown';
  const sourceVersion = `OFF ${date}`;
  const result: AdapterResult = { sourceVersion, inputFiles: [file], foods: [], skipped: [] };
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const p = JSON.parse(line) as OffProduct;
    const n = normalizeOffProduct(p, sourceVersion);
    if (n.food) result.foods.push(n.food);
    else result.skipped.push({ sourceFoodId: p.code, name: p.product_name ?? '', reason: n.reason! });
  }
  return result;
}
