# Phase 0 Research: NutriPet MVP

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-08

The repository contains no application code (only Spec Kit scaffolding), so there is no
existing stack to follow. Every choice below picks the smallest option that meets the spec and
the constitution. The workstation has Node 22, pnpm 10 and Docker 29.

---

## R1. Application shape and stack

**Decision**: One TypeScript web application: **Next.js (App Router) + React**. It is installed as
a **PWA** so it opens like an app on the phone. A framework-free **domain package** sits inside the
same repo.

**Rationale**:
- Two users, a mobile-first UI and server-side validation (Constitution VI) need a server and a
  UI. Next.js serves both from one deployable: route handlers / server actions for the backend,
  React for the UI. This avoids running and versioning two projects.
- TypeScript gives explicit types end to end (Constitution §4). Zod schemas are shared by client
  and server, but the server always re-validates.
- A PWA gives an icon on the home screen and full-screen use. The app-store and native builds that
  React Native would need are not justified for 2 users.

**Alternatives considered**:
- *Vite SPA + separate Fastify API*: cleaner separation, but two deployables and duplicated
  plumbing for no MVP benefit.
- *React Native / Expo*: better native feel, but needs app-store or sideload distribution and a
  separate backend anyway.
- *Python (FastAPI) + SPA*: Python is good for data import, but it adds a second language. The
  importers are simple ETL and are written comfortably in TypeScript.

## R2. Persistence

**Decision**: **SQLite** (a single file, WAL mode) accessed via **Drizzle ORM** with versioned SQL
migrations. Food search uses **SQLite FTS5** with the `unicode61 remove_diacritics 2` tokenizer
plus prefix queries.

**Rationale**:
- Expected data size is tiny: 2 profiles, ~3–10k foods, a few thousand entries per year. SQLite
  needs no database server, is trivially backed up (copy the file) and works offline on the host.
- FTS5 with diacritics removal meets FR-022 (search that ignores accents and case:
  "platano" = "plátano") without a search service.
- Drizzle keeps the schema typed in TypeScript and produces readable SQL migrations.
- Multi-user design is enforced by `profile_id` foreign keys and scoped queries, not by the
  database engine. Migrating to Postgres later is mechanical if ever needed.

**Alternatives considered**: PostgreSQL (needs a server process, overkill for two users);
IndexedDB-only/offline-first (no backend validation or shared device sync; violates
Constitution VI); Prisma (heavier runtime, weaker SQLite FTS support).

## R3. Authentication: per-profile PIN (FR-004)

**Decision**: A profile selector plus a PIN of 4–6 digits per profile.
- PIN hashed with **argon2id** (`@node-rs/argon2`). Only the hash is stored.
- On success the server issues an **HTTP-only, SameSite=Strict session cookie** (random 256-bit
  token, stored hashed in a `session` table) bound to one profile. The `Secure` flag is controlled
  by `COOKIE_SECURE` (default `true` when `NODE_ENV=production`, `false` otherwise), so local
  development over plain HTTP on the LAN works while production always requires HTTPS. HttpOnly
  and SameSite=Strict apply in every environment. Sessions expire after **15 minutes of
  inactivity** and on "switch profile".
- Lockout: after **5 consecutive failures**, the profile is locked for 60 s; the wait doubles on
  each further failed series, capped at 15 min. Counters live in the database, per profile.
  **Recovery-code attempts** use the same policy with their own counter
  (`failed_recovery_attempts`, `recovery_locked_until`). A successful recovery resets both the
  recovery and the PIN counters and lockouts.
- **Profile creation and discovery** (FR-008):
  - While **no profiles exist**, `POST /profiles` is open. The device that completes setup is
    enrolled.
  - Afterwards, creation requires an authenticated profile session or the `SETUP_TOKEN` (env var,
    ≥ 32 random chars). The token is entered in a setup form, posted to the server and compared
    in constant time. It is never stored client-side, embedded in the bundle or exposed through
    `NEXT_PUBLIC_*`.
  - The profile selector is returned only to **enrolled devices**: an `np_device` HTTP-only cookie
    (random token, stored hashed in `device`, 180-day expiry, revocable). A new device enrolls
    with the `SETUP_TOKEN` or with a **one-time pairing code** (8 characters, valid 10 min)
    generated from an authenticated session on an enrolled device.
  - Login (`POST /session`) also requires an enrolled device.
  - Setup-token and pairing-code attempts are rate limited per client IP (5 failures → 15-min
    block, in-memory limiter, single instance).
  - `GET /setup/status` returns only `{ needsInitialSetup, deviceEnrolled }`.
- **Every** profile-scoped query takes `profileId` from the session, never from the request body
  or URL. A single `requireProfile()` guard is used by all handlers.
- **PIN recovery**: a one-time **recovery code** (12 characters, shown once at profile creation,
  stored hashed) lets the owner reset the PIN. A server CLI command (`pnpm admin:reset-pin`) is
  the operator fallback; it resets the PIN without displaying any data.

**Rationale**: matches the clarification (shared app, a PIN for each profile) and the
constitution's privacy rules with minimal UX friction. A 4–6 digit PIN is weak on its own, so the
lockout and the server-side check are what make it adequate for this threat model (another
household member, a lost phone).

**Alternatives considered**: full accounts with e-mail and password (rejected in clarification
Q1); a PIN check only on the client (no real protection).

## R4. Hosting and deployment

**Decision**: Ship as a **Docker image** (Node 22 alpine) with the SQLite file on a mounted
volume. The default target is any small always-on host (home server / mini-PC, or a VPS), behind
HTTPS (Caddy or the platform's TLS). Backups are a nightly copy of the database file (SQLite
`VACUUM INTO`).

**Rationale**: both users need the same data from their phones, so the app must run on a host
both phones can reach. Docker is already installed and makes the deployment reproducible.

**Open question (non-blocking)**: the final host (home network vs. a VPS) is left to the owner.
The image is the same either way. PWA install and Secure cookies require HTTPS.

## R5. Testing

**Decision**:
- **Vitest** for unit tests of the domain package: nutrient math, BMR/TDEE, MET, energy balance
  sign, day status, streaks/freezes, XP caps/revocation, pet stages and mood. This is mandatory
  by the constitution and FR-091.
- **Vitest + a temporary SQLite database** for integration tests: repositories, profile isolation,
  snapshot immutability, importer idempotency.
- **Playwright** (mobile viewport, 390×844) for a small set of end-to-end flows matching the
  quickstart scenarios.
- Property-based tests (**fast-check**) for linearity of the nutrient math (scaling) and for the
  invariant "XP never decreases with missed days".

**Rationale**: the risk sits in calculations and isolation rules, so most tests target pure
functions, which are fast and deterministic. End-to-end tests are kept few to stay maintainable.

## R6. Nutritional data sources

### R6.1 USDA FoodData Central (FDC)

- **Access**: REST API (`api.nal.usda.gov/fdc/v1`, free api.data.gov key, default limit
  ~1,000 requests/hour). Full **bulk downloads** (CSV and JSON) also exist for each dataset:
  Foundation Foods, SR Legacy, FNDDS (Survey), Branded.
- **License**: public domain / **CC0 1.0**. Citation is requested (e.g., "U.S. Department of
  Agriculture, Agricultural Research Service. FoodData Central, <year>. fdc.nal.usda.gov").
- **Fit**: excellent for generic raw and cooked staples (rice, eggs, chicken, beef, fish,
  potatoes, beans, lentils, oats, milk, fruits, vegetables) with explicit preparation states
  ("Rice, white, long-grain, cooked"). Nutrient IDs: energy 1008 (kcal) or the Atwater-specific
  2047/2048, protein 1003, carbohydrate 1005, fat 1004, fiber 1079, total sugars 2000,
  sodium 1093. All values are per 100 g.
- **Decision**: the importer reads the **bulk JSON** of Foundation + SR Legacy (versioned by its
  release date), filtered by a curated **allowlist** of FDC IDs (`data/sources/usda/allowlist.csv`,
  about 300–500 items covering the spec's food list). This keeps the catalog relevant and
  searchable, and gives each food a Spanish alias. The API is not called at runtime.

### R6.1b USDA FNDDS (Food and Nutrient Database for Dietary Studies)

- **Access**: part of FoodData Central ("Survey Foods"), with a bulk JSON/CSV download per release
  cycle. Same CC0 license and citation as FDC.
- **Fit**: generic foods "as consumed" and many **prepared dishes** (mixed dishes, cooked
  preparations), complementing Foundation and SR Legacy. It may include some Latin American
  preparations. **Whether it has Colombian-style arepa, patacón or local cheeses must be checked
  against the downloaded release before relying on it**; nothing is assumed.
- **Decision**: separate data source id `usda_fndds`, loaded by the same USDA adapter with its own
  allowlist (`data/sources/usda/allowlist-fndds.csv`). Items are added only when the FNDDS
  description actually matches the food. A US dish is never relabeled as a different Colombian
  dish.

### R6.2 Tabla de Composición de Alimentos Colombianos (TCAC, ICBF)

- **Access**: published by ICBF (latest edition 2015, with later web consultation). Distributed as
  a PDF publication and an online lookup. **No documented public API or machine-readable bulk
  download was identified.**
- **License**: a government publication. Explicit reuse terms for redistributing a derived
  dataset are **not clearly stated**. They must be verified with ICBF before the full table is
  bundled.
- **Fit**: the most relevant source for Colombian foods: arepas, plantain preparations (patacón,
  maduro), local cheeses (campesino, costeño), panela, bocadillo, local beans, etc.
- **Decision**: a **curated CSV** (`data/sources/tcac/foods.csv`) of about 60–120 priority
  Colombian foods, transcribed from the publication. Each row cites the TCAC code, edition and
  page. It is loaded by the same reproducible importer. Columns follow
  [contracts/food-import-format.md](./contracts/food-import-format.md). Transcribed values are
  reviewed (double entry plus a sanity check: computed kcal is close to 4P + 4C + 9F, within 15%).
- **Risk**: licensing. *Mitigation*: the CSV holds factual values with attribution, kept in a
  separate source directory that can be removed or replaced. Bundling stays behind a feature flag
  (`TCAC_ENABLED`) until reuse is confirmed. USDA equivalents cover the staples meanwhile.

### R6.3 Open Food Facts (OFF)

- **Access**: REST API (`world.openfoodfacts.org/api/v2`). Requests need a custom `User-Agent`.
  Rate limits are roughly 100 requests/min for product reads and **10 requests/min for search**.
  Bulk exports exist (CSV / JSONL / Parquet, several GB).
- **License**: database under **ODbL 1.0** (attribution plus share-alike for the *database* if
  it is redistributed), individual contents under DbCL, images CC-BY-SA. Attribution
  "Open Food Facts contributors" is required.
- **Fit**: Colombian packaged and branded foods (filter `countries_tags=en:colombia`), including
  packaged/pre-cooked arepas when products exist. Data quality varies: values are crowd-sourced and
  sometimes incomplete or per serving. **OFF is not a source for homemade dishes**: a packaged
  arepa product is not "arepa casera" and is never labeled as such.
- **Decision**: the importer pulls a **filtered subset** (country = Colombia, has
  `nutriments.energy-kcal_100g`, protein, carbohydrates and fat) via paged API requests at
  ≤ 10 requests/min, or from a downloaded JSONL dump. It writes a **dated snapshot file**, then
  imports from that snapshot so runs are reproducible. Products missing any core nutrient are
  skipped and listed in the import report. Images are not stored (not needed for the MVP).
  NutriPet does not redistribute the OFF database publicly. A local private copy with
  attribution satisfies ODbL; this is re-checked if the app is ever published.

### R6.4 Source priority and conflict handling

- Source order (FR-023): (1) USDA FDC Foundation/SR Legacy, (2) USDA FNDDS, (3) OFF snapshots
  (packaged/branded only), (4) TCAC once its license is verified (`TCAC_ENABLED`).
- Search ranking breaks ties as: profile custom / override > TCAC > USDA FDC > USDA FNDDS > OFF.
  The same concept from two sources is kept as **separate foods** with visible source badges,
  never merged silently (Constitution I).
- Every imported food records `source`, `source_food_id`, `source_version` (dataset release or
  snapshot date), and `import_run_id`.
- The pipeline is extensible: a new source only needs an adapter producing `NormalizedFood[]`,
  plus a `data_source` row.

### R6.5 Known coverage gaps (FR-024, FR-029)

- `data/sources/KNOWN_GAPS.md` lists foods without a verified record. Initial list: **arepa
  (casera)** (homemade, white/yellow maize), Colombian fresh cheeses (queso campesino, costeño,
  cuajada), patacón, and other homemade preparations, until TCAC is enabled or a verified record is
  found.
- `pnpm import:coverage` checks the FR-024 list against the catalog after each import and writes
  `data/import-reports/coverage-<date>.json`; any item still missing must appear in KNOWN_GAPS.md.
- In the app, a search with no verified result offers "Crear alimento personalizado" (the user
  enters values from a source they trust, such as a label or their own recipe calculation, and the
  food is marked `user`). The app never fills the gap with another food's values.

## R7. History preservation (snapshots and versions)

**Decision**: **Food versions plus entry snapshots.**
- `food` is the stable identity. `food_version` holds the nutrition values. Each import or
  correction that changes values inserts a new version and marks it current. Old versions are
  never updated or deleted.
- `meal_entry` stores `food_version_id` **and** a copy of the computed nutrient amounts (and the
  per-100 values used). Display reads the snapshot, so later catalog changes cannot alter history
  (FR-033, SC-006), even if versions were ever pruned.
- Foods are "deleted" by setting `hidden_at`; they are never removed if referenced.

**Alternatives considered**: snapshots only (loses provenance for audits); versions only (one
extra join for every read, and fragile if a version is lost).

### R7b. Settings history and day energy snapshots (FR-019)

**Decision**: the same versioning idea is applied to profile settings.
- `profile_settings_version` rows are effective-dated (`effective_from` local date). Every change
  to an energy-relevant field inserts a new row effective **today**. Several changes on one day:
  the latest row for that date wins. Rows are never updated.
- `day_energy_snapshot` (one per profile and date) is created when the day first receives a food
  or activity entry. It stores the settings version id, weight used, age, BMR, multiplier, baseline
  TDEE, adjustment, recommended and active target, macro targets, formula and `calc_version`
  (bumped whenever a formula or constant in `src/domain/config.ts` changes).
- Past-day summaries read only the snapshot plus that day's entries, so they are reproducible.
- **Today's** snapshot is refreshed when settings change today. The UI says "aplicado desde hoy".
- **Backfill**: a day without a snapshot resolves the settings version with the greatest
  `effective_from ≤ date` (or the first version if the date precedes it) and the latest weight
  record on or before the date (else the earliest record). Then it writes its snapshot.
- Editing a weight record later does not touch existing past snapshots; it affects the trend and
  days without a snapshot yet.
- Activity MET estimates use the snapshot's weight.

**Alternatives considered**: recomputing from current settings (violates Constitution I); storing
only per-day targets (loses the inputs needed to explain the calculation, FR-018).

## R8. Energy calculation method (FR-010–FR-018)

**Decision**:
- BMR uses Mifflin-St Jeor (default; Harris-Benedict revised is selectable, both documented). For
  "other / prefer not to say", the constant is the mean of +5 and −161 = **−78**.
- Age is computed from the date of birth on the date being calculated.
- Weight is the most recent weight record **on or before** the day being calculated, frozen in the
  day energy snapshot (R7b).
- Baseline TDEE = BMR × multiplier (1.2 / 1.375 / 1.55 / 1.725 / 1.9). The multiplier describes
  *non-exercise* daily life.
- Activity net kcal = (MET − 1) × kg × hours. The resting MET (1.0) is removed because the BMR
  part of the baseline TDEE already covers it. A manual estimate replaces the computed value. No
  estimate means 0 kcal.
- Daily estimated expenditure = baseline TDEE + Σ activity net kcal.
- Recommended target = baseline TDEE + adjustment. It does **not** move with exercise (FR-013).
- Balance = expenditure − intake (positive = estimated deficit).
- Safety caution: target < max(BMR, 1,200) **or** |adjustment| > 25% × baseline TDEE.
- MET defaults come from the **2024 Adult Compendium of Physical Activities** (e.g., walking
  moderate 3.5, running ~8–9.8, cycling moderate 6.8, swimming moderate 5.8, resistance training
  3.5–6.0, volleyball 4.0 (recreational) / 8.0 (competitive), basketball 6.5, tennis 7.3). They
  are stored as editable seed data with the Compendium code cited.

**Rationale**: removing the resting MET avoids counting resting energy twice. Keeping the target
fixed avoids an "eat back your exercise" loop. Both are explained on the "how is this calculated?"
screen.

## R9. Liquids and units

**Decision**: each food version has `basis` = `g` | `ml`, plus an optional `density_g_per_ml`.
The user enters quantities in the food's basis by default. Conversion happens only when the unit
differs: with the density if known, otherwise at 1 g/ml with the entry flagged `approximate=true`.
Everything is stored in metric units. Imperial units are converted for display and input only.

## R10. Gamification defaults (tunable configuration, versioned in code)

| Source | XP | Daily cap (per logged date) |
|---|---|---|
| Food entry logged (`food_entry`) | 2 | 20 |
| Food day completed (`food_day`, FR-061) | 15 | 15 |
| Activity logged (`activity`) | 5 | 10 |
| Activity bonus (`activity_bonus`: day completed and ≥ 1 activity) | 1 | 1 |
| Weight recorded (`weight`, ≥ 3 days since last rewarded) | 10 | 10 |
| Streak bonus (`streak`: current streak ≥ 3, day reward-eligible) | min(streak, 10) | 10 |
| Milestone (7/14/30/60/100-day streaks, first full week) | 25–100 | n/a, one-time |

- Typical consistent day: ~20 + 15 + 5 + 1 + ~10 = **~51 XP**. Stage thresholds (cumulative XP):
  newborn 0 → young 300 (~6 days) → adolescent 1,200 (~3–4 weeks) → adult 3,000 (~2 months) →
  special 5,500 (~108 days, within FR-073's 90–120 day target).
- **Backfill window** = 2 days (`BACKFILL_WINDOW_DAYS`). XP only for logged dates ≥ today − 2
  (FR-071).
- **Revocation (FR-074)**: XP never decreases because of missed days, target outcomes or normal
  progression. XP events are tied to their source record: deleting the record revokes its event,
  and if a day stops being completed, its `food_day`, `activity_bonus`, `streak` events and its
  treat are revoked. Caps are recomputed from the remaining events. The stage uses
  `max_xp_reached`, so it never decreases.
- **Treats (FR-075)**: 1 per day that reaches a completed state (`food_completed`,
  `full_completed`, `rest_completed`), so at most 1 per day. `activity_only` days give none.
  Milestones may add treats. A revoked treat is removed only if still unspent, so the balance never
  goes below 0. Feeding a treat gives +15 mood (cap 100).
- **Mood**: 0–100 with a floor of **30** (labels: Feliz ≥ 70, Contento ≥ 50, Somnoliento ≥ 30).
  −10 per fully missed day, never below the floor. +10 on any logging action.
- **Streak freezes (FR-064)**: +1 for every 7 **reward-eligible** completed days, cumulative and
  not necessarily consecutive. At most 2 are held; extra freezes earned while holding 2 are lost.
  A freeze is consumed only for a missed day inside an active streak when at least one is owned.
  The frozen day keeps the streak without incrementing it. A day is reward-eligible when its
  `first_completed_at` local date is ≤ its date + 2. Non-eligible completed days still count for
  state, totals and streak length, but earn no freezes, streak XP or streak milestones.
- **Goal-specific presentation (FR-078)**: message keys are chosen by (event, goal). The amounts
  above never read the goal. A property test checks that two profiles with the same actions but
  different goals and kcal produce the same XP, treats, freezes and stage.

## R11. Pet visuals

**Decision**: 5 static SVG illustrations (one per stage) plus a few SVG accessory overlays (hat,
scarf, bow, glasses, crown) positioned by anchor points per stage. CSS-only micro-animations
(blink, bounce on feed). No animation engine. The art is original and drawn for the project.

## R12. Localization and time zones

**Decision**: the UI is in Spanish (es-CO). Strings live in a single dictionary file so English
can be added later. Food aliases are stored in both `es` and `en`. Each profile has an IANA time
zone (default `America/Bogota`). A "logged date" is computed in that zone at entry time and stored
explicitly as a `YYYY-MM-DD` local date next to the UTC timestamp.

## R13. Performance targets

**Food search target: ≤ 100 ms p95**, measured as server handler time for `GET /foods?q=` (FTS
prefix query, limit 20) over 200 representative queries of 1–3 tokens. The catalog holds 10k
foods and the test runs on the reference host (Node 22, SQLite file on local SSD, warm process).
Dashboard data comes in a single request (≤ 200 ms p95, same conditions). Optimistic UI updates
make totals refresh immediately (FR-034). No caching layer.

---

## Technical risks and open questions (deliverable §15.7)

| # | Risk / question | Impact | Mitigation |
|---|---|---|---|
| 1 | TCAC reuse license unclear; no machine-readable source | Colombian coverage (arepa casera, local cheeses) | Curated attributed CSV behind `TCAC_ENABLED`; ask ICBF; USDA FDC + FNDDS + OFF (packaged) meanwhile; gaps listed in KNOWN_GAPS.md; custom foods as the user-controlled alternative |
| 2 | OFF data quality (missing or per-serving values) | Wrong packaged values | Import only complete per-100 records; source badge; user override (FR-026) |
| 3 | Manual TCAC transcription errors | Accuracy | Double entry plus Atwater sanity check in importer tests |
| 4 | Hosting location undecided | Deployment | Same Docker image anywhere; HTTPS required |
| 5 | A short PIN is guessable | Privacy | argon2id, server-side lockout, inactivity timeout |
| 6 | MET estimates vary a lot by person | Balance accuracy | Always labeled estimate; manual override; target ignores exercise |
| 7 | Gamification tuning (too slow or too fast) | Engagement | Constants in one config module; recompute from events |
| 8 | Weight-trend smoothing with sparse data | Misleading trend | Moving average uses available points; trend hidden when fewer than 3 points |
| 9 | FNDDS coverage of Colombian dishes unknown | Coverage | Verify against the downloaded release; never relabel non-matching dishes |
| 10 | Lost enrolled device or leaked SETUP_TOKEN | Privacy | Devices revocable; rotate SETUP_TOKEN via env; rate limits |
