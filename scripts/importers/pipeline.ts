/**
 * Shared, idempotent import pipeline (FR-023, contracts/food-import-format.md).
 * Upserts by (data_source_id, source_food_id); a nutrient change creates a new immutable food_version;
 * name/alias changes update the food only. meal_entry rows are never touched.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import { db, tx, type Db } from '../../src/server/db/client';
import { food, foodAlias, foodVersion, importRun, type DataSourceId } from '../../src/server/db/schema';
import { newId } from '../../src/server/db/ids';
import { nowIso } from '../../src/server/clock';
import type { AdapterResult, NormalizedFood } from './normalized';
import { validateFood } from './validate';

export interface ImportReport {
  source: DataSourceId;
  sourceVersion: string;
  checksum: string;
  dryRun: boolean;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  rejected: { sourceFoodId: string; name: string; errors: string[] }[];
  adapterSkipped: AdapterResult['skipped'];
  warnings: { sourceFoodId: string; name: string; warnings: string[] }[];
  importRunId: string | null;
  reportPath: string | null;
}

export function checksumFiles(files: string[]): string {
  const h = crypto.createHash('sha256');
  for (const f of [...files].sort()) {
    h.update(path.basename(f));
    h.update(fs.readFileSync(f));
  }
  return h.digest('hex');
}

const NUTRIENT_KEYS = ['basis', 'kcal', 'proteinG', 'carbsG', 'fatG', 'fiberG', 'sugarG', 'sodiumMg', 'densityGPerMl'] as const;

function sameNutrients(v: typeof foodVersion.$inferSelect, f: NormalizedFood): boolean {
  return NUTRIENT_KEYS.every((k) => {
    const a = v[k] ?? null;
    const b = (f[k] as number | string | null | undefined) ?? null;
    return typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b;
  });
}

function syncAliases(d: Db, foodId: string, aliases: NormalizedFood['aliases']): boolean {
  const wanted = new Map((aliases ?? []).map((a) => [`${a.lang}:${a.alias.toLowerCase()}`, a]));
  const existing = d.select().from(foodAlias).where(eq(foodAlias.foodId, foodId)).all();
  let changed = false;
  for (const e of existing) {
    const key = `${e.lang}:${e.alias.toLowerCase()}`;
    if (wanted.has(key)) wanted.delete(key);
    else {
      d.delete(foodAlias).where(and(eq(foodAlias.foodId, foodId), eq(foodAlias.alias, e.alias), eq(foodAlias.lang, e.lang))).run();
      changed = true;
    }
  }
  for (const a of wanted.values()) {
    d.insert(foodAlias).values({ foodId, alias: a.alias, lang: a.lang }).onConflictDoNothing().run();
    changed = true;
  }
  return changed;
}

function insertVersion(d: Db, foodId: string, versionNo: number, f: NormalizedFood, source: DataSourceId, runId: string | null): string {
  const id = newId();
  d.insert(foodVersion)
    .values({
      id,
      foodId,
      versionNo,
      basis: f.basis,
      kcal: f.kcal,
      proteinG: f.proteinG,
      carbsG: f.carbsG,
      fatG: f.fatG,
      fiberG: f.fiberG,
      sugarG: f.sugarG,
      sodiumMg: f.sodiumMg,
      densityGPerMl: f.densityGPerMl ?? null,
      dataSourceId: source,
      sourceVersion: f.sourceVersion,
      importRunId: runId,
      createdAt: nowIso(),
    })
    .run();
  return id;
}

export function runImport(
  source: DataSourceId,
  input: AdapterResult,
  opts: { dryRun?: boolean; reportDir?: string | null } = {},
): ImportReport {
  const checksum = checksumFiles(input.inputFiles);
  const report: ImportReport = {
    source,
    sourceVersion: input.sourceVersion,
    checksum,
    dryRun: Boolean(opts.dryRun),
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: input.skipped.length,
    rejected: [],
    adapterSkipped: input.skipped,
    warnings: [],
    importRunId: null,
    reportPath: null,
  };

  const valid: NormalizedFood[] = [];
  const seen = new Set<string>();
  for (const f of input.foods) {
    if (seen.has(f.sourceFoodId)) {
      report.rejected.push({ sourceFoodId: f.sourceFoodId, name: f.nameEs, errors: ['duplicate sourceFoodId in input'] });
      continue;
    }
    seen.add(f.sourceFoodId);
    const v = validateFood(f);
    if (!v.ok) report.rejected.push({ sourceFoodId: f.sourceFoodId, name: f.nameEs, errors: v.errors });
    else {
      if (v.warnings.length) report.warnings.push({ sourceFoodId: f.sourceFoodId, name: f.nameEs, warnings: v.warnings });
      valid.push(f);
    }
  }
  report.skipped += report.rejected.length;

  const runId = opts.dryRun ? null : newId();
  const started = nowIso();
  if (runId) {
    db()
      .insert(importRun)
      .values({ id: runId, dataSourceId: source, sourceVersion: input.sourceVersion, inputChecksum: checksum, startedAt: started, status: 'running' })
      .run();
  }

  const apply = (d: Db) => {
    for (const f of valid) {
      const existing = d.select().from(food).where(and(eq(food.dataSourceId, source), eq(food.sourceFoodId, f.sourceFoodId))).get();
      const ts = nowIso();
      if (!existing) {
        const foodId = newId();
        d.insert(food)
          .values({
            id: foodId,
            dataSourceId: source,
            sourceFoodId: f.sourceFoodId,
            ownerProfileId: null,
            nameEs: f.nameEs,
            nameEn: f.nameEn ?? null,
            category: f.category,
            preparationState: f.preparationState,
            brand: f.brand ?? null,
            createdAt: ts,
            updatedAt: ts,
          })
          .run();
        syncAliases(d, foodId, f.aliases);
        const versionId = insertVersion(d, foodId, 1, f, source, runId);
        d.update(food).set({ currentVersionId: versionId }).where(eq(food.id, foodId)).run();
        report.created++;
        continue;
      }
      let changed = false;
      const current = existing.currentVersionId
        ? d.select().from(foodVersion).where(eq(foodVersion.id, existing.currentVersionId)).get()
        : undefined;
      if (!current || !sameNutrients(current, f)) {
        const last = d.select({ n: foodVersion.versionNo }).from(foodVersion).where(eq(foodVersion.foodId, existing.id)).all();
        const next = Math.max(0, ...last.map((r) => r.n)) + 1;
        const versionId = insertVersion(d, existing.id, next, f, source, runId);
        d.update(food).set({ currentVersionId: versionId, updatedAt: ts }).where(eq(food.id, existing.id)).run();
        changed = true;
      }
      const meta = {
        nameEs: f.nameEs,
        nameEn: f.nameEn ?? null,
        category: f.category,
        preparationState: f.preparationState,
        brand: f.brand ?? null,
      };
      if ((Object.keys(meta) as (keyof typeof meta)[]).some((k) => existing[k] !== meta[k])) {
        d.update(food).set({ ...meta, updatedAt: ts }).where(eq(food.id, existing.id)).run();
        changed = true;
      }
      if (syncAliases(d, existing.id, f.aliases)) changed = true;
      if (changed) report.updated++;
      else report.unchanged++;
    }
  };

  try {
    if (opts.dryRun) {
      // Compute counts inside a transaction that is always rolled back.
      try {
        tx((d) => {
          apply(d);
          throw new RollbackSignal();
        });
      } catch (e) {
        if (!(e instanceof RollbackSignal)) throw e;
      }
    } else {
      tx(apply);
    }
  } catch (err) {
    if (runId) db().update(importRun).set({ status: 'failed', finishedAt: nowIso() }).where(eq(importRun.id, runId)).run();
    throw err;
  }

  if (opts.reportDir !== null) {
    const dir = opts.reportDir ?? path.resolve('data/import-reports');
    fs.mkdirSync(dir, { recursive: true });
    report.reportPath = path.join(dir, `${source}-${started.replace(/[:.]/g, '-')}${opts.dryRun ? '-dry' : ''}.json`);
  }
  report.importRunId = runId;
  if (runId) {
    db()
      .update(importRun)
      .set({
        status: 'ok',
        finishedAt: nowIso(),
        created: report.created,
        updated: report.updated,
        unchanged: report.unchanged,
        skipped: report.skipped,
        reportPath: report.reportPath ? path.relative(process.cwd(), report.reportPath) : null,
      })
      .where(eq(importRun.id, runId))
      .run();
  }
  if (report.reportPath) fs.writeFileSync(report.reportPath, JSON.stringify(report, null, 2));
  return report;
}

class RollbackSignal extends Error {}
