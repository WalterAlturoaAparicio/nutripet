/**
 * Builds a dated Open Food Facts snapshot of packaged products sold in Colombia (T055).
 * Respects the search rate limit (≤ 10 requests/min) and sends the required custom User-Agent.
 * The importer reads only this snapshot, so imports stay reproducible and offline.
 *
 *   pnpm fetch:off [--max-pages N]   (pages per query, default 10)
 */
import fs from 'node:fs';
import path from 'node:path';

const FIELDS = 'code,product_name,product_name_es,brands,quantity,nutrition_data_per,categories_tags,nutriments';
const PAGE_SIZE = 100;
const MIN_INTERVAL_MS = 6500; // ≤ 10 search requests per minute
const NUTRIMENT_KEYS = [
  'energy-kcal_100g',
  'energy_100g',
  'proteins_100g',
  'carbohydrates_100g',
  'fat_100g',
  'fiber_100g',
  'sugars_100g',
  'sodium_100g',
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Anonymous search pagination stops after ~10 pages (HTTP 401), so besides the general query the
 * snapshot also runs one query per relevant category, each within that limit, de-duplicated by code.
 */
const QUERIES: { label: string; extra: string }[] = [
  { label: 'general', extra: '' },
  { label: 'arepas', extra: '&categories_tags_en=arepas' },
  { label: 'breads', extra: '&categories_tags_en=breads' },
  { label: 'dairies', extra: '&categories_tags_en=dairies' },
  { label: 'beverages', extra: '&categories_tags_en=beverages' },
  { label: 'cereals', extra: '&categories_tags_en=cereals-and-potatoes' },
  { label: 'snacks', extra: '&categories_tags_en=snacks' },
  { label: 'sauces', extra: '&categories_tags_en=sauces' },
  { label: 'meats', extra: '&categories_tags_en=meats' },
];
const MAX_PAGES_PER_QUERY = 10;

async function main() {
  const ua = process.env.OFF_USER_AGENT;
  if (!ua) throw new Error('Define OFF_USER_AGENT (p. ej. "NutriPet/0.1 (proyecto personal)")');
  const i = process.argv.indexOf('--max-pages');
  const maxPages = i >= 0 ? Number(process.argv[i + 1]) : MAX_PAGES_PER_QUERY;
  const date = new Date().toISOString().slice(0, 10);
  const dir = path.resolve('data/sources/off');
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `snapshot-${date}.jsonl`);
  const products = new Map<string, string>();

  for (const q of QUERIES) {
    let page = 1;
    let pageCount = 1;
    let retries = 0;
    while (page <= pageCount && page <= maxPages) {
      const url =
        'https://world.openfoodfacts.org/api/v2/search?countries_tags_en=colombia&states_tags=en:nutrition-facts-completed' +
        `${q.extra}&fields=${FIELDS}&page_size=${PAGE_SIZE}&page=${page}&sort_by=code`;
      const started = Date.now();
      const res = await fetch(url, { headers: { 'User-Agent': ua } });
      if ((res.status === 429 || res.status >= 500) && retries < 3) {
        retries++;
        console.log(`[${q.label}] HTTP ${res.status} en página ${page}; reintento en 60 s`);
        await sleep(60_000);
        continue;
      }
      if (res.status === 401 || res.status === 403 || !res.ok) {
        console.log(`[${q.label}] HTTP ${res.status} en página ${page}; se detiene esta consulta`);
        break;
      }
      retries = 0;
      const body = (await res.json()) as { page_count: number; products: Record<string, unknown>[] };
      pageCount = body.page_count;
      for (const p of body.products) {
        const code = String(p.code ?? '');
        if (!code || products.has(code)) continue;
        const n = (p.nutriments ?? {}) as Record<string, unknown>;
        const nutriments = Object.fromEntries(NUTRIMENT_KEYS.filter((k) => n[k] !== undefined).map((k) => [k, n[k]]));
        products.set(code, JSON.stringify({ ...p, code, nutriments }));
      }
      console.log(`[${q.label}] página ${page}/${Math.min(pageCount, maxPages)} — ${products.size} productos`);
      page++;
      const wait = MIN_INTERVAL_MS - (Date.now() - started);
      if (wait > 0) await sleep(wait);
    }
  }
  const lines = [...products.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, l]) => l);
  fs.writeFileSync(out, `${lines.join('\n')}\n`);
  console.log(`Snapshot: ${path.relative(process.cwd(), out)} (${lines.length} productos)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
