# USDA FoodData Central

Public domain (CC0 1.0). Citation: *U.S. Department of Agriculture, Agricultural Research Service.
FoodData Central. fdc.nal.usda.gov.*

## Pinned releases

Downloaded by `pnpm fetch:usda` from `https://fdc.nal.usda.gov/fdc-datasets/`:

| Dataset | File | NutriPet source |
|---|---|---|
| Foundation Foods 2026-10-29 | `FoodData_Central_foundation_food_json_2026-10-29.zip` | `usda_fdc` |
| SR Legacy 2018-04 (final) | `FoodData_Central_sr_legacy_food_json_2018-04.zip` | `usda_fdc` |
| FNDDS (Survey Foods) 2024-10-31 | `FoodData_Central_survey_food_json_2024-10-31.zip` | `usda_fndds` |

The zip and extracted JSON files are large and are not committed (`.gitignore`). `fetch:usda`
prints each file's sha256, and every import run records a checksum of its inputs. To move to a
newer release, change the file name in `scripts/fetch-usda.ts` and `scripts/importers/usda.ts`,
then re-run the fetch and the import. Changed values become new food versions, and past entries
keep their snapshots.

## Allowlists

Only allowlisted foods are imported:

- `allowlist.csv` → Foundation + SR Legacy
- `allowlist-fndds.csv` → FNDDS

Columns: `fdc_id, name_es, aliases_es (|-separated), category, preparation_state, basis,
density_g_per_ml`. `basis=ml` requires a density; values are then converted from per 100 g to per
100 ml (× density).

**Review rule**: `name_es` must translate the USDA description faithfully. A food is never renamed
into a different dish, and aliases must not point to a different food. Rejected examples:

- "deslactosada" on regular milk;
- "kumis" on yogurt;
- "perico" on scrambled egg;
- "masarepa" on nixtamalized masa;
- "arepa" on FNDDS *Arepa Dominicana*.

Raw and cooked variants are separate rows.

Data notes found during import:

- Foundation 2026 milk and heavy-cream records report sugars above carbohydrates (carbs by
  difference vs. measured sugars). SR Legacy milk is used instead. Heavy cream was dropped.
- Foundation mayonnaise lacks a core nutrient, so SR Legacy `171009` is used.

See `FNDDS_REVIEW.md` for the FNDDS investigation.
