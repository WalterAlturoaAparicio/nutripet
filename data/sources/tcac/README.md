# Tabla de Composición de Alimentos Colombianos (TCAC, ICBF)

**Status: disabled** (`TCAC_ENABLED=false`). The reuse license for redistributing values from the
ICBF publication has not been verified. Until it is, this source is not imported and `foods.csv`
contains only its header.

## Why it matters

The TCAC is the most relevant source for Colombian foods that USDA and Open Food Facts do not
cover with a verified record: homemade arepa, Colombian fresh cheeses (campesino, costeño,
cuajada), patacón and other preparations. See `../KNOWN_GAPS.md`.

## Transcription process (once the license allows it)

1. Transcribe one row per food from the official publication into `foods.csv`, citing `edition`
   and `page`. Values are per 100 g (or 100 ml) exactly as published. Never estimate a missing
   value: leave `fiber_g`, `sugar_g`, `sodium_mg` or `density_g_per_ml` empty if the table lacks it.
2. **Double entry**: a second person checks every row against the publication and writes their
   name in `verified_by`. The importer rejects rows with an empty `verified_by`.
3. Run `TCAC_ENABLED=true pnpm import:foods --source tcac` and review the report. The Atwater
   check (kcal ≈ 4P + 4C + 9F) flags likely typos.
4. Remove the items now covered from `../KNOWN_GAPS.md` and rerun `pnpm import:coverage`.

## Columns

`tcac_code, name_es, aliases_es (|-separated), category, preparation_state, basis, kcal, protein_g,
carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, density_g_per_ml, edition, page, transcribed_by,
verified_by`

Categories and preparation states use the NutriPet enums listed in
`specs/001-nutripet-mvp/data-model.md`.
