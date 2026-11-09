/**
 * Coverage report against the FR-024 list (T137, FR-029). Exits non-zero when an item is missing from
 * the catalog and not documented in data/sources/KNOWN_GAPS.md.
 *
 *   pnpm import:coverage
 */
import fs from 'node:fs';
import path from 'node:path';
import { prepareDatabase } from '../src/server/db/setup';
import { setDbHandle } from '../src/server/db/client';
import { searchFoods } from '../src/server/modules/foods/service';
import { parseCsv } from './importers/csv';

export interface CoverageItem {
  id: string;
  label: string;
  found: number;
  examples: string[];
  documentedGap: boolean;
}

export function knownGapIds(file = path.resolve('data/sources/KNOWN_GAPS.md')): Set<string> {
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  return new Set([...text.matchAll(/^id:\s*([a-z0-9_]+)/gm)].map((m) => m[1]!));
}

export function coverage(listFile = path.resolve('data/sources/coverage-list.csv'), gapsFile?: string): CoverageItem[] {
  const gaps = knownGapIds(gapsFile);
  return parseCsv(fs.readFileSync(listFile, 'utf8')).map((row) => {
    const { items } = searchFoods('__coverage__', {
      q: row.query || undefined,
      state: (row.state || undefined) as 'raw' | 'cooked' | 'prepared' | 'packaged' | undefined,
      limit: 5,
    });
    return {
      id: row.id!,
      label: row.label!,
      found: items.length,
      examples: items.slice(0, 3).map((f) => `${f.nameEs}${f.brand ? ` (${f.brand})` : ''} [${f.source}]`),
      documentedGap: gaps.has(row.id!),
    };
  });
}

function main() {
  const { handle } = prepareDatabase(process.env.DATABASE_PATH || './data/nutripet.db');
  setDbHandle(handle);
  const items = coverage();
  const undocumented = items.filter((i) => i.found === 0 && !i.documentedGap);
  const dir = path.resolve('data/import-reports');
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `coverage-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), items, undocumented: undocumented.map((i) => i.id) }, null, 2));
  console.table(
    items.map((i) => ({
      id: i.id,
      encontrado: i.found > 0 ? 'sí' : 'no',
      brecha_documentada: i.documentedGap ? 'sí' : '',
      ejemplo: i.examples[0] ?? '',
    })),
  );
  console.log(`Reporte: ${path.relative(process.cwd(), out)}`);
  handle.sqlite.close();
  if (undocumented.length) {
    console.error(`Faltan sin documentar en KNOWN_GAPS.md: ${undocumented.map((i) => i.id).join(', ')}`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) main();
