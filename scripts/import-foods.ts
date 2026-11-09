/**
 * Reproducible catalog import (FR-023). Reads pinned local files only; never calls the network.
 *
 *   pnpm import:foods --all
 *   pnpm import:foods --source usda_fdc|usda_fndds|off|tcac [--input <file-or-dir>] [--dry-run]
 */
import { prepareDatabase } from '../src/server/db/setup';
import { setDbHandle } from '../src/server/db/client';
import { ADAPTERS, adapterFor } from './importers/registry';
import { runImport } from './importers/pipeline';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main() {
  const all = process.argv.includes('--all');
  const dryRun = process.argv.includes('--dry-run');
  const source = arg('source');
  if (!all && !source) {
    console.error('Uso: pnpm import:foods --all | --source <fuente> [--input <ruta>] [--dry-run]');
    process.exit(2);
  }
  const { handle } = prepareDatabase(process.env.DATABASE_PATH || './data/nutripet.db');
  setDbHandle(handle);

  const adapters = all ? ADAPTERS : [adapterFor(source!)];
  const rows: Record<string, string | number>[] = [];
  let failed = false;
  for (const a of adapters) {
    if (!a.enabled()) {
      rows.push({ fuente: a.sourceId, estado: 'deshabilitada' });
      continue;
    }
    try {
      const input = a.load(all ? undefined : arg('input'));
      const r = runImport(a.sourceId, input, { dryRun });
      rows.push({
        fuente: a.sourceId,
        version: r.sourceVersion,
        creados: r.created,
        actualizados: r.updated,
        sin_cambios: r.unchanged,
        omitidos: r.skipped,
        rechazados: r.rejected.length,
        advertencias: r.warnings.length,
      });
      if (r.reportPath) console.log(`Reporte: ${r.reportPath}`);
      // Rejections in curated sources (USDA allowlists, TCAC) are curation mistakes and fail the run.
      // Crowd-sourced OFF data always has some inconsistent rows: they are excluded and reported.
      if (r.rejected.length && a.sourceId !== 'off') failed = true;
    } catch (e) {
      rows.push({ fuente: a.sourceId, estado: `no importada: ${(e as Error).message}` });
      if (!all) failed = true;
    }
  }
  console.table(rows);
  handle.sqlite.close();
  if (failed) process.exit(1);
}

main();
