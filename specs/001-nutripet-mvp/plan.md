# Implementation Plan: NutriPet MVP

**Branch**: `001-nutripet-mvp` | **Date**: 2026-11-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-nutripet-mvp/spec.md`

## Summary

NutriPet is a mobile-first, multi-profile nutrition and activity tracker with a virtual cat
that grows with consistent logging. The two initial users (one gaining, one losing weight) share
one installed app and pick their profile from a selector protected by a PIN for each profile.

The technical approach is a single **TypeScript Next.js PWA** with a **SQLite** database.
- A **framework-free domain module** holds every calculation: nutrients, energy, day status,
  streaks, XP, pet.
- A **versioned food catalog** is filled by a **reproducible offline import pipeline** from USDA
  FoodData Central, a curated Colombian TCAC CSV and an Open Food Facts snapshot.
- **Meal entries snapshot** the nutrient values they used, so later catalog changes never alter
  history.
- **Effective-dated profile settings** and **day energy snapshots** keep past targets, TDEE and
  balances reproducible after settings change (FR-019).
- **Device enrollment** plus protected profile creation (FR-008) keep profile names away from
  unknown clients.
- Gamification rewards are identical across goals; only **messages** are goal-specific (FR-078).
- **Multi-item meals** are built client-side and saved in one transaction; **preparations**
  (recipes) are immutable versions of ingredient compositions whose totals are the sum of each
  ingredient's contribution; meal entries reference the exact recipe version (FR-035a, FR-038–FR-049).

Research decisions: [research.md](./research.md). Schema: [data-model.md](./data-model.md).
Interfaces: [contracts/](./contracts/).

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22 LTS

**Primary Dependencies**:
- Next.js 15 (App Router, route handlers + server actions), React 19.
- Zod (shared validation), Drizzle ORM + better-sqlite3, @node-rs/argon2 (PIN hashing).
- Tailwind CSS (styling), Recharts (weight and intake charts), Serwist (PWA service worker),
  ulid.

**Storage**: SQLite (WAL) single file. FTS5 (`unicode61 remove_diacritics 2`) for food search.
Drizzle SQL migrations.

**Testing**: Vitest (domain unit, fast-check property tests, integration tests on a temporary
SQLite database), Playwright (mobile-viewport end-to-end tests).

**Target Platform**: Mobile browsers (iOS Safari 17+, Android Chrome) as an installable PWA;
desktop browsers secondary. Server: Docker image (Node 22 alpine) on a small always-on host
behind HTTPS.

**Project Type**: Web application (full-stack monolith: UI and API in one deployable)

**Performance Goals**:
- Food search: **≤ 100 ms p95** server handler time for `GET /foods?q=` (FTS prefix, limit 20),
  over 200 representative 1–3-token queries, with a 10k-food catalog, on the reference host
  (Node 22, SQLite on local SSD, warm process). This is the same definition as research.md R13.
- Dashboard and day summary in one request at ≤ 200 ms p95 under the same conditions.
- Totals update immediately through optimistic UI (SC-001: log one item in under 20 s).

**Constraints**:
- Every input validated on the server (Constitution VI).
- Cookies are HttpOnly and SameSite=Strict everywhere. `Secure` comes from `COOKIE_SECURE`
  (true in production, false for local HTTP on the LAN).
- `SETUP_TOKEN` is server-only and never uses a `NEXT_PUBLIC_` variable.
- The app keeps working with no external network access; imports run from pinned local files.
- Responsive at 360–430 px widths with no horizontal scroll.
- Spanish UI.
- Stored values in metric units only.

**Scale/Scope**: 2 profiles (designed for N). About 3–10k foods. About 5k entries per profile per
year. 7 screens plus profile selector and onboarding.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Gate | Pre-research | Post-design evidence |
|---|---|---|---|
| I. Accuracy & Data Integrity | Sources identified; preparation states; no fabricated values; metric units; user corrections; immutable history | ✅ | `food_version` immutable + `meal_entry` snapshots (data-model, R7); settings versions + day energy snapshots (R7b, FR-019); unknown nutrients stay null (FR-021); importer rejects rather than "fixes" bad rows, with a no-substitution rule and documented gaps (FR-029); `food_override` for corrections |
| II. Individual Profiles | Profile-owned data; no cross-effects; N profiles | ✅ | Every personal table has `profile_id`, and the session supplies it (`requireProfile`); pet, streak and XP are per profile; nothing assumes 2 users |
| III. Transparency | BMR/TDEE/intake/exercise/balance distinct; documented formulas; no double counting; estimates labeled | ✅ | domain-calculations contract; net MET (MET − 1); target ignores exercise; `isEstimate` in every response; "¿Cómo se calcula?" view (FR-018) |
| IV. Gamification for habits (v1.1.0) | Rewards consistency only; mild penalties; transparent rules; presentation adapted per goal; reward mechanics equivalent across goals | ✅ | XP, treats and freezes (R10) never read kcal or goal; goal-specific message catalog (FR-078); mood floor 30; XP only lost when its records are deleted; stage monotonic; lenient freezes; property test for goal invariance |
| V. Usability | Few taps; fast search; gram entry; mobile; quick reuse | ✅ | One-tap logging from Home, quick list (favorites, frequent, templates), batch entry API, FTS prefix search, PWA |
| VI. Privacy & Security | Isolation; authentication and authorization; backend validation; data minimization | ✅ | argon2id PIN and recovery code with lockouts, HTTP-only sessions, device enrollment, protected profile creation (FR-008), 404 for foreign records, Zod on the server; no e-mail or other personal data collected |
| §3 Data sources | Prioritized sources; required fields; license compliance | ✅ (TCAC license pending, gated by flag) | R6 evaluation; attribution screen; `TCAC_ENABLED` gate |
| §4 Architecture | Modular; domain separate from UI; no premature abstraction; tests | ✅ | `src/domain` has no framework imports; one deployable; no repository or DI layers beyond plain modules |
| §7 Definition of Done | Documented, tested, persisted, validated, usable | ✅ | quickstart scenarios plus test strategy below |

**Result**: PASS, no violations. Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-nutripet-mvp/
├── plan.md              # This file
├── research.md          # Phase 0: decisions, data source evaluation, risks
├── data-model.md        # Phase 1: entities, schema, state transitions
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── http-api.md              # REST/server-action contract
│   ├── food-import-format.md    # import pipeline and source adapters
│   └── domain-calculations.md   # pure function contracts + mandatory test examples
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── domain/                  # pure TS, no I/O, no React/Next imports
│   ├── nutrition/           # scale.ts (scaleNutrients, sumNutrients, unit conversion), recipe.ts (computePreparation, portionNutrients)
│   ├── energy/              # bmr, tdee, targets, cautions, activity MET, daily balance
│   ├── tracking/            # dayStatus, streaks, freezes, month %
│   ├── gamification/        # xp rules & caps, stages, mood, treats, milestones
│   ├── weight/              # moving-average trend
│   └── config.ts            # multipliers, MET defaults, XP/threshold constants
├── server/
│   ├── db/                  # drizzle schema, migrations, client, seed
│   ├── auth/                # PIN/recovery hashing, sessions, lockouts, devices, setup token, rate limit, requireProfile()
│   ├── modules/             # thin services per bounded area, calling domain + db
│   │   ├── profiles/ day-energy/ foods/ journal/ recipes/ activity/ weight/ calendar/ pet/ progress/
│   └── validation/          # shared Zod schemas
├── app/                     # Next.js App Router
│   ├── (auth)/              # select (selector + PIN), onboarding, enroll, recover
│   ├── (app)/               # inicio (home; `/` redirects there), diario, actividad, calendario, progreso, alimentos, mascota, perfil
│   └── api/v1/              # route handlers (per contracts/http-api.md)
├── ui/                      # React components (pet, progress rings, food search, charts, journal/ meal builder, recipes/ builder + portion picker)
└── i18n/es.ts               # Spanish strings

scripts/
├── import-foods.ts          # pipeline entry (contracts/food-import-format.md)
├── import-coverage.ts       # FR-024 coverage report (FR-029)
├── importers/               # registry.ts, pipeline.ts, usda.ts (usda_fdc + usda_fndds), off.ts, tcac.ts
├── fetch-off.ts, fetch-usda.ts
├── seed-demo.ts, backup-db.ts
└── admin-reset-pin.ts

data/
├── sources/{usda,tcac,off}/ # pinned inputs (+ allowlists / curated CSV), README per source
├── sources/coverage-list.csv, sources/KNOWN_GAPS.md
└── import-reports/

docs/                        # project documentation deliverables
├── calculations.md          # formulas, constants, sign convention, streak/XP rules (Constitution III)
├── data-sources.md          # sources, licenses, attribution, source order, known gaps
├── gamification-messaging.md# goal-specific message guidelines and review checklist (FR-078)
└── operations.md            # deployment, backups, SETUP_TOKEN rotation, device revocation

public/pet/                  # stage SVGs + accessory overlays

tests/
├── unit/domain/             # mirrors src/domain
├── integration/             # db, isolation, snapshots, importer idempotency
└── e2e/                     # Playwright flows from quickstart
```

**Structure Decision**: one Next.js project at the repository root. `src/domain` is the
framework-independent core (Constitution §4). `src/server/modules` are thin modules matching the
spec's areas (§12: user management, food catalog, meal tracking, calculations, activity, weight,
gamification, analytics/progress). There are no separate frontend and backend packages, because
the PWA is the only client.

## Feature Breakdown & MVP Implementation Plan (deliverables §15.5–6)

Slices follow the spec's user-story priorities. Each slice ends demonstrable and tested.

| Phase | Slice | Contents | Exit check |
|---|---|---|---|
| 0 | Foundation | Repo scaffold, lint/typecheck/test tooling, Drizzle schema + migrations, seed data, CI script, i18n skeleton, PWA shell | `pnpm test` runs; empty app installs as PWA |
| 1 | Domain core | All `src/domain` functions + reference tests + property tests | All domain-calculations examples pass |
| 2 | US1 Profiles & access | Onboarding, device enrollment, protected creation, PIN/recovery lockouts, settings versions + day energy snapshots, profile edit, energy view + explanation (pet fields null) | Quickstart 1, 2, 2b, 13 |
| 3 | Catalog & import | Importer pipeline + registry, USDA FDC allowlist (~300–500 items), FNDDS allowlist (verified matches only), OFF snapshot (packaged), TCAC CSV (flagged), coverage report + KNOWN_GAPS, FTS search, food detail, sources screen | Import is idempotent; quickstart 3, 4b (search part), 11, 12 |
| 4 | US2 Meal journal | Day view, add/edit/delete, batch add, duplicate, templates, snapshots, immediate totals | Quickstart 4 |
| 5 | US3 Dashboard & activity | Home dashboard, activity types/entries, MET estimate, balance | Quickstart 5, 14 |
| 6 | US4 Custom foods & quick-add | Custom foods, overrides, favorites, frequent list | US4 scenarios |
| 7 | US5 Weight | Records CRUD, trend, chart, target comparison | Quickstart 6 |
| 8 | US6 Calendar & streaks | Day flags, calendar grid, day detail, streak cache, freezes | Quickstart 7–9 |
| 9 | US7 Pet | Pet state, XP and treat events, caps, revocation, stages, mood, feeding, milestones, accessories, goal-specific messages, pet screen `/mascota`, SVG art | Quickstart 10 |
| 10 | US8 Progress | Weekly and monthly summaries, intake chart | US8 scenarios |
| 11 | Hardening | Docker/Caddy, backups, e2e suite, accessibility pass, attribution review, `docs/` deliverables | Full quickstart |
| 12 | US9 Multi-food meals & preparations | Domain preparation functions + tests; migration 0009 (recipe, recipe_version, recipe_ingredient; recipe-aware meal_entry/meal_template_item; food.product_form); water reference record; recipes module/routes; `PUT /meals/{id}`; meal builder, recipe builder, portion picker; product form on custom foods | Quickstart 15, 16; `tests/unit/domain/recipe.test.ts`, `tests/integration/meals-recipes.test.ts`, `migration-recipes.test.ts` |

Phases 1 and 3 can proceed in parallel after phase 0. Phases 6–10 depend on 4–5 but are
independent of each other.

## Test Strategy (deliverable §15.8)

- **Unit (domain)**: every function in [contracts/domain-calculations.md](./contracts/domain-calculations.md),
  including all reference examples. Boundary cases: 0 g, unknown nutrients, ml/g without
  density, age on a birthday, a day at the time-zone edge, streak across months, freezes at the
  cap, XP at the cap, backfill window.
- **Property-based**: nutrient scaling is linear and additive; XP and stage never decrease over
  missed days; XP, treats, freezes and stage are independent of goal type and kcal; the balance
  sign matches its label; freezes never go negative or above 2.
- **Integration (SQLite)**:
  - profile isolation: every endpoint, given another profile's id, returns 404;
  - snapshot immutability after a new food version;
  - importer idempotency and versioning;
  - PIN and recovery lockout timing;
  - protected profile creation and selector discovery (no device, no token, wrong token);
  - past-day summaries unchanged after a settings change; backfill resolves the effective version;
  - streak cache recompute after backfill; backfill outside the window earns no freeze;
  - XP and treat revocation on delete;
  - multi-item meals saved/edited atomically, recipe versions and catalog updates never changing
    logged entries, migration 0009 preserving existing rows (US9).
- **Preparations (unit)**: powder in water/milk, quantity variations, zero-calorie water, a nonzero
  liquid, multi-ingredient, whole/partial/servings, yield ≠ ingredient sum, invalid references,
  homogeneous vs non-homogeneous; property: portions of the yield add up to the total.
- **E2E (Playwright, mobile viewport)**: onboarding with two profiles; log breakfast by grams;
  build a multi-food meal with a preparation and save it at once;
  activity and balance; calendar completion; profile switch isolation.
- **Data quality**: import reports are checked in CI. Zero validation errors are allowed for the
  enabled sources. Atwater warnings are reviewed.
- **Gate**: domain coverage ≥ 95% lines; all tests are required to pass before a slice counts as
  done (Constitution §7).

## Complexity Tracking

No constitution violations to justify.
