# Contract: Food Import Pipeline

Reproducible and idempotent import of catalog foods (FR-023, Constitution §3). Run with:

```text
pnpm import:foods --source usda_fdc|usda_fndds|off|tcac [--input <file>] [--dry-run]
pnpm import:foods --all            # in source order: usda_fdc → usda_fndds → off → tcac (if enabled)
pnpm import:coverage               # checks the FR-024 list (data/sources/coverage-list.csv) against the catalog
```

**Extensibility**: a source is an adapter module in `scripts/importers/<source>.ts` exporting
`{ sourceId, read(inputPath): AsyncIterable<NormalizedFood> }`, registered in
`scripts/importers/registry.ts`, plus a seeded `data_source` row. The pipeline, validation and
versioning are shared.

**No substitution rule**: adapters never copy values from one food to another, never rename a
food into a different dish, and never fill missing nutrients. Foods without a verified record
stay missing and are listed in `data/sources/KNOWN_GAPS.md` (FR-029).

## Pipeline

```text
source file (pinned) ──► adapter (source-specific parse) ──► NormalizedFood[] ──► validator
   ──► upsert by (data_source_id, source_food_id)
         · new                → food + food_version v1 + aliases
         · nutrient change    → new food_version, current_version_id moves
         · name/alias change  → update food/aliases only (no new version)
         · identical          → unchanged
   ──► import_run row + report (data/import-reports/<source>-<timestamp>.json)
```

- Inputs are **pinned files** under `data/sources/<source>/`, with their checksum recorded in
  `import_run`. Remote data is fetched into such a file first by a separate step
  (`pnpm fetch:off`, `pnpm fetch:usda`). The import itself never calls the network, so it is
  reproducible offline (FR-025).
- Running the same input twice gives `created=0, updated=0`.
- **Existing `meal_entry` rows are never touched** (FR-033).

## NormalizedFood (adapter output)

| Field | Required | Notes |
|---|---|---|
| sourceFoodId | yes | FDC ID / TCAC code / OFF barcode |
| nameEs | yes | USDA items get a Spanish name from the allowlist |
| nameEn | no | |
| aliases | no | `[{ alias, lang }]` |
| category | yes | mapped to the NutriPet category enum |
| preparationState | yes | `raw`/`cooked`/`prepared`/`packaged` |
| brand | no | |
| basis | yes | `g` or `ml` |
| kcal, proteinG, carbsG, fatG | yes | per 100 of the basis |
| fiberG, sugarG, sodiumMg | no | `null` when the source lacks them, never 0 |
| densityGPerMl | no | |
| sourceVersion | yes | e.g. `SR Legacy 2018-04`, `FDC Foundation 2024-10`, `TCAC 2015`, `OFF 2026-11-01` |

**Validation (row is rejected and reported, never "fixed")**: missing core nutrient; negative
values; kcal > 900; P + C + F > 100 g per 100 g; sugar > carbs + max(0.5 g, 10% of carbs).
**Warnings** (imported, but flagged in the report): a smaller sugar excess over carbs, a known source
artifact (carbs computed by difference vs. measured sugars, e.g. USDA milk); and the Atwater check
|kcal − (4P + 4C + 9F)| > max(15%, 20 kcal). Fiber and alcohol can legitimately cause deviations.

## Source adapters

### `usda_fdc`
- Input: FDC bulk JSON (Foundation and SR Legacy) plus `data/sources/usda/allowlist.csv`.
- Allowlist columns: `fdc_id, name_es, aliases_es (|-separated), category, preparation_state,
  basis`.
- Nutrient mapping: kcal = 1008 (fallback 2047, then 2048), protein 1003, carbs 1005, fat 1004,
  fiber 1079, sugar 2000 (fallback 269), sodium 1093.
- Attribution: "USDA, Agricultural Research Service. FoodData Central." License: CC0.

### `usda_fndds`
- Input: FDC "Survey Foods (FNDDS)" bulk JSON in `data/sources/usda/` plus
  `data/sources/usda/allowlist-fndds.csv` (same columns as the main allowlist).
- Same nutrient mapping and attribution as `usda_fdc`. sourceVersion e.g. `FNDDS 2021-2023`.
- An allowlist row may only map an FNDDS food to a Spanish name describing **the same food or
  dish**. Entries are reviewed by checking the FNDDS description, not by assumption.

### `tcac`
- Input: `data/sources/tcac/foods.csv` (curated transcription).
- Columns: `tcac_code, name_es, aliases_es, category, preparation_state, basis, kcal, protein_g,
  carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, density_g_per_ml, edition, page, transcribed_by,
  verified_by`.
- The importer refuses rows where `verified_by` is empty (double-entry rule, research R6.2).
- Disabled unless `TCAC_ENABLED=true` (pending license confirmation).

### `off`
- Input: `data/sources/off/snapshot-<date>.jsonl` produced by `pnpm fetch:off` (country Colombia,
  paged at ≤ 10 search requests/min, `User-Agent: NutriPet/0.1 (<contact>)`).
- Uses `nutriments.energy-kcal_100g` (else `energy_100g` / 4.184), `proteins_100g`,
  `carbohydrates_100g`, `fat_100g`, `fiber_100g`, `sugars_100g`, `sodium_100g` × 1000 (g → mg).
- Basis is `ml` when `nutrition_data_per` is `100ml` or the product quantity unit is ml/l,
  otherwise `g`.
- preparationState = `packaged`. brand = first of `brands`. category is mapped from
  `categories_tags`, falling back to `empacados`.
- Attribution: "Open Food Facts contributors, ODbL 1.0".
- Scope: packaged/branded products only. Product names are kept as published (e.g., a packaged
  "Arepa de maíz blanco" from a brand); they are never relabeled as homemade dishes.

## Coverage report

`pnpm import:coverage` reads `data/sources/coverage-list.csv` (the FR-024 items with search
terms, e.g. `arroz|cocido`, `arepa|casera`) and searches the catalog for each. It writes
`data/import-reports/coverage-<date>.json` with `found` / `missing` per item and exits non-zero
when a missing item is not listed in `data/sources/KNOWN_GAPS.md`.
