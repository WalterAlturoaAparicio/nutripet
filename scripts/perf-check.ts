/**
 * Performance check (T125, plan.md / research.md R13): food search p95 ≤ 100 ms and dashboard (day
 * summary) p95 ≤ 200 ms, measured as handler time, with a 10k-food catalog and the 60-day demo history.
 * Runs on a temporary database; the catalog is padded with synthetic fixture foods that never touch
 * real data.
 *
 *   pnpm tsx scripts/perf-check.ts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { prepareDatabase } from '../src/server/db/setup';
import { setDbHandle } from '../src/server/db/client';
import { setNow } from '../src/server/clock';
import { runImport } from './importers/pipeline';
import type { NormalizedFood } from './importers/normalized';
import { seedProfileTimeline, demoStart } from './demo/seed';

process.env.SESSION_SECRET ||= 'perf-check-session-secret-0123456789abcdef';
process.env.COOKIE_SECURE = 'false';

const WORDS = ['arroz', 'pollo', 'huevo', 'leche', 'pan', 'queso', 'papa', 'platano', 'frijol', 'lenteja', 'avena', 'mango', 'tomate', 'cebolla', 'carne', 'pescado', 'yogur', 'galleta', 'jugo', 'cereal'];
const MODS = ['blanco', 'integral', 'cocido', 'crudo', 'frito', 'asado', 'light', 'entero', 'dulce', 'salado', 'natural', 'casero'];
const BRANDS = ['Marca A', 'Marca B', 'Marca C', null];

function percentile(xs: number[], p: number) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
}

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'np-perf-'));
  const { handle } = prepareDatabase(path.join(dir, 'perf.db'));
  setDbHandle(handle);

  const foods: NormalizedFood[] = Array.from({ length: 10_000 }, (_, i) => ({
    sourceFoodId: `perf-${i}`,
    nameEs: `${WORDS[i % WORDS.length]} ${MODS[(i * 7) % MODS.length]} ${i}`,
    aliases: [{ alias: WORDS[(i + 3) % WORDS.length]!, lang: 'es' }],
    category: 'otros',
    preparationState: (['raw', 'cooked', 'prepared', 'packaged'] as const)[i % 4]!,
    brand: BRANDS[i % 4]!,
    basis: 'g',
    kcal: 50 + (i % 400),
    proteinG: i % 20,
    carbsG: i % 50,
    fatG: i % 25,
    fiberG: null,
    sugarG: null,
    sodiumMg: null,
    sourceVersion: 'synthetic perf fixture',
  }));
  const file = path.join(dir, 'perf-foods.json');
  fs.writeFileSync(file, '[]');
  runImport('off', { sourceVersion: 'perf', inputFiles: [file], foods, skipped: [] }, { reportDir: null });

  const today = new Date().toISOString().slice(0, 10);
  setNow(new Date(Date.parse(`${demoStart(today)}T12:00:00Z`)));
  const { POST: createProfile } = await import('../src/app/api/v1/profiles/route');
  const res = await createProfile(
    new Request('http://localhost/api/v1/profiles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Perf', birthDate: '1995-01-01', sexForFormula: 'female', heightCm: 165, weightKg: 60, targetWeightKg: 60, goalType: 'maintenance', activityLevel: 'light', pin: '1234' }),
    }),
    { params: Promise.resolve({}) },
  );
  const body = (await res.json()) as { profile: { id: string } };
  const ids = handle.sqlite.prepare("SELECT id FROM food WHERE source_food_id IN ('perf-0','perf-1','perf-2')").all() as { id: string }[];
  seedProfileTimeline(body.profile.id, today, { a: ids[0]!.id, b: ids[1]!.id, c: ids[2]!.id });
  setNow(undefined);

  const { searchFoods } = await import('../src/server/modules/foods/service');
  const { getDaySummary } = await import('../src/server/modules/journal/service');
  const queries = Array.from({ length: 200 }, (_, i) => {
    const n = 1 + (i % 3);
    return Array.from({ length: n }, (_, k) => {
      const w = k === 0 ? WORDS[i % WORDS.length]! : MODS[(i + k) % MODS.length]!;
      return k === n - 1 ? w.slice(0, 3 + (i % (w.length - 2))) : w;
    }).join(' ');
  });
  for (const q of queries.slice(0, 20)) searchFoods(body.profile.id, { q, limit: 20 }); // warm up
  const searchTimes = queries.map((q) => {
    const t0 = performance.now();
    searchFoods(body.profile.id, { q, limit: 20 });
    return performance.now() - t0;
  });
  const days = Array.from({ length: 60 }, (_, i) => new Date(Date.parse(`${today}T12:00:00Z`) - i * 86_400_000).toISOString().slice(0, 10));
  const dashTimes = [...days, ...days, ...days].map((d) => {
    const t0 = performance.now();
    getDaySummary(body.profile.id, d);
    return performance.now() - t0;
  });

  const s95 = percentile(searchTimes, 95);
  const d95 = percentile(dashTimes, 95);
  console.table([
    { check: 'food search (10k foods, 200 queries)', p50_ms: percentile(searchTimes, 50).toFixed(1), p95_ms: s95.toFixed(1), target_ms: 100, ok: s95 <= 100 },
    { check: 'day summary (60-day history)', p50_ms: percentile(dashTimes, 50).toFixed(1), p95_ms: d95.toFixed(1), target_ms: 200, ok: d95 <= 200 },
  ]);
  handle.sqlite.close();
  fs.rmSync(dir, { recursive: true, force: true });
  if (s95 > 100 || d95 > 200) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
