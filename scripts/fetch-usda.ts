/**
 * Downloads the pinned USDA FoodData Central bulk JSON releases (T053) into data/sources/usda/
 * and extracts the JSON. The importer never touches the network; it reads these files.
 *
 *   pnpm fetch:usda
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { unzipSync } from 'fflate';

export const USDA_RELEASES = [
  { key: 'foundation', file: 'FoodData_Central_foundation_food_json_2026-10-29.zip', version: 'FDC Foundation 2026-10-29' },
  { key: 'sr_legacy', file: 'FoodData_Central_sr_legacy_food_json_2018-04.zip', version: 'SR Legacy 2018-04' },
  { key: 'fndds', file: 'FoodData_Central_survey_food_json_2024-10-31.zip', version: 'FNDDS 2024-10-31' },
] as const;

const BASE = 'https://fdc.nal.usda.gov/fdc-datasets/';
const DIR = path.resolve('data/sources/usda');

async function main() {
  fs.mkdirSync(DIR, { recursive: true });
  for (const r of USDA_RELEASES) {
    const zipPath = path.join(DIR, r.file);
    const jsonPath = path.join(DIR, `${r.key}.json`);
    if (!fs.existsSync(zipPath)) {
      process.stdout.write(`Descargando ${r.file}… `);
      const res = await fetch(BASE + r.file);
      if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${r.file}`);
      fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
      console.log('ok');
    }
    const zip = fs.readFileSync(zipPath);
    const sha = crypto.createHash('sha256').update(zip).digest('hex');
    const entries = unzipSync(new Uint8Array(zip), { filter: (f) => f.name.endsWith('.json') });
    const [name, content] = Object.entries(entries)[0] ?? [];
    if (!name || !content) throw new Error(`No hay JSON dentro de ${r.file}`);
    fs.writeFileSync(jsonPath, content);
    console.log(`${r.version}: ${(zip.length / 1e6).toFixed(1)} MB zip, sha256 ${sha} → ${path.relative(process.cwd(), jsonPath)}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
