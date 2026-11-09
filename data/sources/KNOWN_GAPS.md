# Known coverage gaps (FR-024, FR-029)

Foods commonly eaten in Colombia **without a verified nutritional record** in the enabled sources.
NutriPet never fills these with another food's values. Until a verified source exists, log them as
a **custom food** ("Crear alimento personalizado"), entering values from a source you trust
(package label, or your own recipe calculation from verified ingredients).

`pnpm import:coverage` fails if an item from `coverage-list.csv` is missing from the catalog and
not listed here. Each gap is a heading with its id in the form `id: <coverage id>`.

## arepa_casera
id: arepa_casera
- Food: arepa (casera), white or yellow maize, homemade.
- Why missing: no USDA record. FNDDS only has *Arepa Dominicana* (a different preparation). Open
  Food Facts may list packaged arepas from specific brands, which appear with their brand and an
  "empacado" badge, but they are not homemade arepa.
- Status (OFF snapshot 2026-11-09): packaged products such as "Arepa Casera (La Brasita)" exist and are
  listed with their brand and "empacado" state. They describe that product only; homemade arepa remains a gap.
- Candidate source: TCAC (ICBF), pending license verification.

## queso_campesino
id: queso_campesino
- Food: Colombian fresh cheeses (queso campesino, costeño, cuajada).
- Why missing: USDA only has Mexican-style *queso fresco*, which is kept under its own name.
- Status (OFF snapshot 2026-11-09): branded packaged versions exist (e.g. "Queso Campesino (Colanta)");
  unbranded or artisanal cheeses remain a gap.
- Candidate source: TCAC; packaged products in Open Food Facts.

## patacon
id: patacon
- Food: patacón (twice-fried green plantain).
- Why missing: USDA has *Plantains, green, fried*, imported as "Plátano verde, frito", not the
  patacón preparation.
- Candidate source: TCAC.

## preparaciones_tipicas
id: preparaciones_tipicas
- Food: sancocho, ajiaco, bandeja paisa, Colombian empanada, Colombian tamal, buñuelo, pandebono,
  arepa de huevo, changua.
- Why missing: no matching USDA or FNDDS description (see `usda/FNDDS_REVIEW.md`).
- Candidate source: TCAC, or recipe-based custom foods.

## panela
id: panela
- Food: panela / aguapanela.
- Why missing: no USDA record. Brown sugar is a different product and is not used as a substitute.
- Status (OFF snapshot 2026-11-09): some packaged panela products exist; aguapanela as prepared remains a gap.
- Candidate source: TCAC; packaged panela in Open Food Facts.
