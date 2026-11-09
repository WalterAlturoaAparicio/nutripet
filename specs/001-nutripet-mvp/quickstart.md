# Quickstart & Validation Guide: NutriPet MVP

Use this guide to show, end to end, that the MVP acceptance criteria (spec §13) are met. Details
live in [data-model.md](./data-model.md) and [contracts/](./contracts/). This is not
implementation code.

## Prerequisites

- Node 22 LTS, pnpm 10, Git. Docker is optional (production-like run).
- The pinned source files under `data/sources/`: USDA FDC and FNDDS allowlists and bulk JSON, the
  OFF snapshot, and the TCAC CSV only if `TCAC_ENABLED=true`.

## Setup

```text
pnpm install
cp .env.example .env            # see variables below
pnpm db:migrate                 # create schema + seed data_source, activity_type, milestones, accessories
pnpm import:foods --all         # reproducible catalog import; prints the import report
pnpm import:coverage            # coverage of the FR-024 list; missing items must be in data/sources/KNOWN_GAPS.md
pnpm dev                        # http://localhost:3000
```

`.env` variables:

| Variable | Dev value | Notes |
|---|---|---|
| `SESSION_SECRET` | random 32+ chars | |
| `DATABASE_PATH` | `./data/nutripet.db` | |
| `SETUP_TOKEN` | random 32+ chars | server-only; needed to create profiles or enroll devices after initial setup; never exposed to the browser |
| `COOKIE_SECURE` | `false` | default `true` in production; `false` lets the phone use the LAN dev server over plain HTTP |
| `TCAC_ENABLED` | `false` | enable only after the ICBF license is verified |
| `OFF_USER_AGENT` | `NutriPet/0.1 (<contact>)` | |

**Using a phone on the LAN in development**: run `pnpm dev --hostname 0.0.0.0` and open
`http://<pc-ip>:3000`. With `COOKIE_SECURE=false`, login works over HTTP, and cookies stay
`HttpOnly` and `SameSite=Strict`. Installing as a PWA (service worker) needs HTTPS or
`localhost`, so on the LAN the app runs as a normal web page. Use the Docker + Caddy setup for
installation testing.

Production-like run: `docker compose up --build` (volume `./data`, HTTPS via Caddy,
`COOKIE_SECURE=true`).

## Automated checks

```text
pnpm test            # Vitest: domain unit + property tests, repository/integration tests
pnpm test:e2e        # Playwright, 390×844 viewport
pnpm lint && pnpm typecheck
```

Expected: all green. The domain tests include every reference example in
[contracts/domain-calculations.md](./contracts/domain-calculations.md) (MVP criteria #6, #8, #11,
#15).

## Manual validation scenarios

| # | Scenario | Expected outcome | MVP criterion |
|---|---|---|---|
| 1 | On a fresh database, create profile "A" (gain, +300); the device is enrolled. From A's session, create profile "B" (loss, −400) with its own PIN | Each shows different BMR, TDEE and target, labeled "estimado"; recovery code shown once each | 1, 2 |
| 2 | Enter a wrong PIN for B 5 times, then a wrong recovery code 5 times | Both lock with a countdown (separate counters); no B data visible | Privacy |
| 2b | From a second browser (not enrolled), open the app and call `GET /api/v1/profiles/selector` and `POST /api/v1/profiles` without a token | Enrollment screen; `DEVICE_NOT_ENROLLED` / `FORBIDDEN`; no names revealed. With `SETUP_TOKEN` or a pairing code from A, enrollment succeeds | FR-008 |
| 3 | As A, search "platano", "huevo", "avena", "leche" | Results appear while typing, accents ignored, each variant shows its preparation state (e.g., "cocido"/"crudo") and source badge | 3, 4 |
| 4 | Log breakfast: huevo entero cocido 100 g, mango 70 g, leche entera 200 ml, avena 40 g | Per-item and meal totals match `(quantity / 100) × value per 100`; the day summary updates instantly | 5, 6 |
| 4b | Search "arepa casera" | No verified result is invented; if a packaged arepa from OFF exists it appears with its brand and "empacado" badge. The empty state offers "Crear alimento personalizado". After US4, create "Arepa de maíz (casera)" with values from a source you trust (label, recipe calculation), log 130 g, and check it is marked "creado por el usuario" | FR-024, FR-029 |
| 5 | Log "Voleibol 45 min, moderado", then "Gimnasio 60 min, sin estimación" | Expenditure rises only by the volleyball net kcal; balance sign and label correct | 7, 8 |
| 5b | Next day, change A's activity level from moderate to light, then reopen yesterday | Yesterday's TDEE, target and balance are unchanged; today shows the new values with "aplicado desde hoy" | 14, FR-019 |
| 6 | Record weights on several dates, then edit and delete one | History, trend line and distance to target update; no single-day "progress" message; past days' energy snapshots unchanged | 9 |
| 7 | Log lunch and dinner (3 occasions total) | Today becomes "food tracking completed"; with the activity, "full daily tracking completed" | 10 |
| 8 | On another day log 2 occasions and tap "día completo" | Day counts as completed | 10 |
| 8b | On another day log only an activity | Day shows "solo actividad"; not completed; no treat | FR-060, FR-075 |
| 9 | Use the seed script `pnpm seed:demo` (60 days with gaps, non-consecutive completions and late backfills) and open the calendar | Statuses, frozen days, current and longest streak, total recorded and total completed days, freezes and monthly % match `tests/fixtures/demo-expected.json` | 11 |
| 10 | Check B's pet after A logs heavily; compare pet messages | A's cat gains XP up to the daily caps; B's cat is unchanged; for equal milestones, rewards are equal and messages are goal-specific | 12, 13, FR-078 |
| 11 | Run `pnpm import:foods --source usda_fdc --input <fixture with changed kcal for rice>` | New food version created; yesterday's rice entry still shows its old values | 14 |
| 12 | Disconnect the network and repeat scenario 3 | Search and logging still work | FR-025 |
| 13 | Switch profile and press the browser back button | Selector shown; the previous profile's data is not visible | FR-005 |
| 14 | Open "¿Cómo se calcula?" on the dashboard | Shows the formula, inputs, multiplier, MET values, the settings version in effect, and the no-double-counting note | FR-018 |
| 15 | Open "Agregar comida", choose Desayuno and add huevo 100 g, pan 60 g, queso 30 g without leaving the sheet; edit the bread to 80 g, remove the cheese, save. Then open the meal's "⋯ → Editar comida completa", add mango 70 g and save | Rows stay visible while searching; each row shows qty, unit, kcal, P/C/F; the meal total updates on every change; one save stores all rows; after the edit, kept rows keep their values per 100 | FR-035a, SC-011 |
| 16 | Create a custom food "Refresco en polvo" (dry mix, 400 kcal/100 g). In the meal builder choose "Nueva preparación": powder 20 g + "+ Agua" 300 ml, final quantity 320 ml → save and use; log 200 ml. Then edit the preparation (25 g powder) and re-import/correct the powder | Preparation shows 80 kcal total and 25 kcal/100 ml; the logged entry shows 50 kcal and "200 ml de 320 ml"; logging the powder directly warns that values are for the dry product; after the edits the logged entry still shows 50 kcal and its portion edit uses the old version | FR-038–FR-049, SC-012 |

## Done criteria

All automated checks pass, scenarios 1–16 behave as described, the catalog import report shows no
validation errors for the enabled sources, and every item missing from the coverage report is
listed in `data/sources/KNOWN_GAPS.md`.
