# Food data sources (FR-023, FR-024, FR-029, Constitution I and §3)

## Source order

| # | Source | NutriPet id | Scope | License / attribution | Status |
|---|---|---|---|---|---|
| 1 | USDA FoodData Central: Foundation Foods (2026-10-29) + SR Legacy (2018-04) | `usda_fdc` | generic foods, raw and cooked variants | CC0 1.0. Cite "U.S. Department of Agriculture, Agricultural Research Service. FoodData Central." | 136 curated foods |
| 2 | USDA FNDDS (Survey Foods, 2024-10-31) | `usda_fndds` | generic foods and prepared dishes, only exact matches | CC0 1.0, same citation | 15 curated foods |
| 3 | Open Food Facts (dated snapshot) | `off` | **packaged/branded products sold in Colombia only** | ODbL 1.0 (database), DbCL (contents). "Open Food Facts contributors". | snapshot 2026-11-09: 1,771 products → 1,525 imported, 205 incomplete, 41 rejected as inconsistent |
| 4 | Tabla de Composición de Alimentos Colombianos (ICBF) | `tcac` | Colombian foods and preparations | **reuse license not yet verified** | disabled (`TCAC_ENABLED=false`) |

Search ties are ranked: user's own foods and corrections → TCAC → USDA FDC → FNDDS → OFF. The same
concept from two sources stays as two foods with visible source badges.

## Rules

- **No substitution**: values are never copied from one food to another, a food is never renamed
  into a different dish, and missing nutrients are never filled in. Examples of things refused:
  - FNDDS *Arepa Dominicana* as "arepa";
  - Mexican-style *queso fresco* as "queso campesino";
  - brown sugar as panela;
  - Open Food Facts packaged arepas as "arepa casera".
- **Validation** rejects (and reports) rows with:
  - a missing core nutrient or negative values;
  - kcal > 900 per 100;
  - P + C + F > 100 g per 100 g;
  - sugar > carbs + max(0.5 g, 10%).

  It warns on Atwater deviations, and on small sugar > carbs artifacts where carbohydrate is
  computed "by difference" (e.g. USDA milk).
- **Immutable history**: every changed value creates a new food version. Logged entries keep their
  snapshot.

## Reproducible imports

```text
pnpm fetch:usda          # downloads the pinned USDA releases → data/sources/usda/*.json (prints sha256)
pnpm fetch:off           # builds data/sources/off/snapshot-<date>.jsonl (≤ 10 requests/min, custom User-Agent)
pnpm import:foods --all  # usda_fdc → usda_fndds → off → tcac (if enabled); offline, idempotent
pnpm import:coverage     # checks the FR-024 list; missing items must be in KNOWN_GAPS.md
```

- Every import run records the source version and a sha256 of its input files (`import_run`), and
  writes a JSON report to `data/import-reports/`.
- To update a source, change the pinned file name or fetch a new snapshot, then re-import. Imports
  are idempotent: an identical rerun changes nothing.
- **Open Food Facts pagination**: anonymous search pagination stops at about 10 pages, so the
  snapshot combines a general query with per-category queries (arepas, breads, dairy, beverages,
  cereals, snacks, sauces, meats), de-duplicated by barcode. Only products with complete
  per-100 g/ml nutrition facts are imported.

## Curation details

- `data/sources/usda/README.md`: pinned files, allowlist columns and the review rule.
- `data/sources/usda/FNDDS_REVIEW.md`: the FNDDS investigation, term by term.
- `data/sources/tcac/README.md`: how the Colombian table will be transcribed once the license allows
  it.

## Known gaps

See [`data/sources/KNOWN_GAPS.md`](../data/sources/KNOWN_GAPS.md). Currently:

- **arepa (casera)**;
- Colombian fresh cheeses (queso campesino, costeño, cuajada);
- patacón;
- typical preparations (sancocho, ajiaco, Colombian empanada and tamal, buñuelo…);
- panela.

Until a verified source exists, the app offers "Crear alimento personalizado". The user enters
values from a source they trust (label, own recipe calculation), and the food is marked as
user-created.
