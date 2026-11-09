# Tasks: NutriPet MVP

**Input**: Design documents from `/specs/001-nutripet-mvp/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED. Spec FR-091 and Constitution §4/§7 mandate automated tests for nutrition,
energy, streak and XP logic. Test tasks for domain code come before its implementation and must
FAIL first. Reference examples come from `contracts/domain-calculations.md`.

**Organization**: tasks are grouped by user story (spec.md US1–US8) so each story can be built
and demonstrated on its own.

**Revision 2 (2026-11-08)**: analysis findings D1, C1, D2, F1, S1, I1–I4, A1, A2, U1–U4, F2, F3
were resolved. Original task IDs T001–T126 are kept (some descriptions extended). New tasks
T127–T145 are placed inside the phase where they run, so **execution order follows the position
in this list, not the numeric ID**.

**Revision 3 (2026-11-09)**: User Story 9 (multi-food meals and preparations, spec FR-035a,
FR-035b, FR-038, FR-039, FR-045–FR-049, SC-011, SC-012) adds Phase 12 with tasks T146–T165.
Existing tasks are unchanged; T060/T061/T064/T065 are extended by T153–T160.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: the user story the task belongs to (US1…US9)
- Paths are relative to the repository root (single Next.js project, see plan.md
  "Project Structure")

## Conventions for every task

- Domain code (`src/domain/**`) MUST NOT import React, Next, Drizzle, or anything doing I/O.
- Every route handler in `src/app/api/v1/**` MUST:
  1. call `requireProfile()` (except the public routes `setup/status`, `devices/enroll`,
     `POST /profiles` during initial setup, and the device-only routes `profiles/selector`,
     `session`, `pin-reset`, which call `requireDevice()`);
  2. parse its input with a Zod schema from `src/server/validation/`;
  3. return errors through `src/server/http/errors.ts`;
  4. return `NOT_FOUND` for records owned by another profile.
- Every energy value in a response carries `isEstimate: true`. The UI labels it "estimado".
- Past-day energy values come from `day_energy_snapshot` (FR-019), never from current settings.
- Reward code MUST NOT read goal type or kcal. Only message selection reads the goal (FR-078).
- UI strings go in `src/i18n/es.ts`. Never hard-code Spanish text in components.
- Stored values are metric. Display conversion goes through `src/ui/format/units.ts`.
- Secrets (`SETUP_TOKEN`, `SESSION_SECRET`) are server-only: never `NEXT_PUBLIC_*`, never sent to
  the client.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: project initialization and tooling

- [X] T001 Initialize a pnpm Next.js 15 + React 19 + TypeScript (strict) project at the repo root (App Router, `src/` dir, import alias `@/*`), creating `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`
- [X] T002 Add runtime dependencies (zod, drizzle-orm, better-sqlite3, @node-rs/argon2, ulid, recharts, @serwist/next) and dev dependencies (drizzle-kit, vitest, @vitest/coverage-v8, fast-check, @playwright/test, tsx, eslint, prettier, @types/better-sqlite3) in `package.json`
- [X] T003 [P] Configure ESLint + Prettier in `eslint.config.mjs` and `.prettierrc`, including a `no-restricted-imports` rule that forbids `react`, `next/*`, `drizzle-orm`, `better-sqlite3`, `node:fs` inside `src/domain/**`
- [X] T004 [P] Configure Tailwind CSS in `tailwind.config.ts`, `postcss.config.mjs`, `src/app/globals.css`, with a mobile-first theme (tokens for intake/expenditure/target colors used to distinguish them visually per spec §5)
- [X] T005 [P] Configure Vitest in `vitest.config.ts` (projects `unit` → `tests/unit/**`, `integration` → `tests/integration/**`; coverage threshold 95% lines for `src/domain/**`)
- [X] T006 [P] Configure Playwright in `playwright.config.ts` (single mobile project 390×844, baseURL `http://localhost:3000`, webServer `pnpm build && pnpm start`, test dir `tests/e2e`)
- [X] T007 Add package scripts in `package.json`: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:unit`, `test:integration`, `test:e2e`, `db:generate`, `db:migrate`, `import:foods`, `import:coverage`, `fetch:usda`, `fetch:off`, `seed:demo`, `admin:reset-pin`, `backup:db`
- [X] T008 [P] Create `.env.example` (SESSION_SECRET, DATABASE_PATH=./data/nutripet.db, SETUP_TOKEN (server-only, ≥ 32 chars), COOKIE_SECURE (default true in production, false in dev), TCAC_ENABLED=false, OFF_USER_AGENT, APP_TIMEZONE_DEFAULT=America/Bogota, each with a one-line comment) and `src/server/env.ts`, which validates env vars with Zod at startup, derives `cookieSecure = COOKIE_SECURE ?? NODE_ENV === 'production'`, and is imported only from server code
- [X] T009 [P] Create the directory skeleton with `.gitkeep`: `src/domain/{nutrition,energy,tracking,gamification,weight,progress}/`, `src/server/{db,auth,modules,validation,http}/`, `src/ui/`, `src/i18n/`, `scripts/importers/`, `data/sources/{usda,tcac,off}/`, `data/import-reports/`, `docs/`, `public/pet/`, `tests/{unit/domain,integration,e2e,fixtures}/`; add `.gitignore` entries for `data/*.db*`, `data/backups/`, `data/import-reports/*`, `.env`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: core infrastructure every story depends on

**⚠️ CRITICAL**: no user story work starts until this phase is complete

- [X] T010 Create the SQLite client in `src/server/db/client.ts` (better-sqlite3, WAL mode, `foreign_keys=ON`, single shared instance, `DATABASE_PATH` from env) and `drizzle.config.ts`
- [X] T011 Create the ULID and time helpers in `src/server/db/ids.ts` (`newId()`) and `src/domain/dates.ts` (pure: `isoLocalDate(instant, timeZone)`, `addDays`, `daysBetween`, `isFuture(localDate, today)`, `monthDays(yyyyMm)`)
- [X] T012 [P] Unit tests for `src/domain/dates.ts` in `tests/unit/domain/dates.test.ts` (Bogotá midnight boundary, a non-Bogotá zone such as Europe/Madrid, month lengths, leap year)
- [X] T013 Create the shared domain types in `src/domain/types.ts`: `Nutrients`, `NutrientsPer100`, `Basis`, `Occasion`, `GoalType`, `ActivityLevel`, `Sex`, `DayStatus` (6 states: none, activity_only, food_partial, food_completed, full_completed, rest_completed), `PetStage`, `XpSource` (incl. `activity_bonus`), `SettingsVersion`, `DayEnergySnapshot`, exactly as named in data-model.md
- [X] T014 Create the domain configuration constants in `src/domain/config.ts`: `CALC_VERSION`, activity multipliers (1.2/1.375/1.55/1.725/1.9), safety floor 1200 and 25% rule, default adjustments (+300/−400/0), XP amounts and daily caps (incl. activity_bonus 1/1), treat rule (1 per completed day), stage thresholds (0/300/1200/3000/5500), mood rules (floor 30, −10, +10, +15 feed), freeze rules (1 per 7 reward-eligible completed days, non-consecutive, max 2), `BACKFILL_WINDOW_DAYS = 2`, weight XP spacing (3 days), all from research.md R8/R10; document in a header comment that changing any formula constant requires bumping `CALC_VERSION`
- [X] T015 Create the HTTP error helpers in `src/server/http/errors.ts` (`ApiError` with codes VALIDATION 422, UNAUTHENTICATED 401, DEVICE_NOT_ENROLLED 401, FORBIDDEN 403, LOCKED 423, RATE_LIMITED 429, NOT_FOUND 404, CONFLICT 409, CONFIRM_REQUIRED 409; `toResponse(err)`) and `src/server/http/handler.ts` (`route(schema, fn)` wrapper that parses JSON/query with Zod, maps ZodError to VALIDATION with field messages in Spanish, and catches ApiError)
- [X] T016 Create the profile tables and migration: `profile` (identity, PIN/recovery hashes, PIN and recovery lockout fields, data preferences weight_unit/height_unit/food_unit/time_zone, target_weight_kg — per data-model.md "profile"; energy settings live in T129), `session`, `weight_record` in `src/server/db/schema/profiles.ts`; run `pnpm db:generate` to produce `src/server/db/migrations/0000_*.sql`
- [X] T017 Implement the session primitives in `src/server/auth/session.ts`: `createSession(profileId)` (256-bit random token, SHA-256 hash stored, cookie `np_session` with `HttpOnly`, `SameSite=Strict`, `Path=/`, and `Secure` = `env.cookieSecure`), `readSession()` with 15-min inactivity expiry and `last_seen_at` refresh, `destroySession()`; add a shared `cookieOptions()` helper reused by the device cookie (T133)
- [X] T018 Implement `requireProfile()` in `src/server/auth/require-profile.ts`, returning `{ profileId, profile }` from the session or throwing UNAUTHENTICATED; it is the ONLY way handlers obtain a profileId
- [X] T019 [P] Create the Spanish dictionary skeleton in `src/i18n/es.ts` with `t(key, params)` helper and sections: common, onboarding, auth, devices, dashboard, journal, foods, activity, weight, calendar, pet (incl. `pet.msg.{gain,loss,maintenance}.*` namespaces), progress, errors, estimates
- [X] T020 [P] Create the unit formatting helpers in `src/ui/format/units.ts` for display/input only: kg↔lb, cm↔ft/in, g↔oz and ml↔fl oz driven by the profile's `weight_unit`/`height_unit`/`food_unit` (FR-007); `formatKcal` rounds to integer, `formatGrams` to 1 decimal per FR-037; `formatEstimate(value)` appends "(estimado)"; conversions always store metric
- [X] T021 Create the app shell: `src/app/(app)/layout.tsx` with bottom tab navigation (Inicio, Diario, Actividad, Calendario, Progreso) plus header menu (Alimentos, Mascota, Perfil, Cambiar perfil); redirects to `/select` when there is no session; `src/ui/nav/BottomNav.tsx`
- [X] T022 [P] Configure the PWA with Serwist in `next.config.ts`, `src/app/sw.ts`, `src/app/manifest.ts` (name NutriPet, `lang: es-CO`, standalone, icons in `public/icons/`); the service worker registers only in secure contexts (HTTPS or localhost) and the app works without it on LAN HTTP
- [X] T023 Create the migration runner and seed entry in `scripts/db-migrate.ts` (applies Drizzle migrations, then runs idempotent seeders registered in `src/server/db/seed/index.ts`)
- [X] T024 [P] Create the integration-test harness in `tests/integration/helpers/db.ts` (fresh temp SQLite file per test file, runs migrations + seeds; `asProfile(profileId)` helper that fakes a session for handler calls; `asDevice()` and `anonymous()` helpers; a controllable clock `setToday(date)`)

**Checkpoint**: foundation ready. User story work can begin.

---

## Phase 3: User Story 1 — Create and configure an independent profile (Priority: P1) 🎯 MVP

**Goal**: protected onboarding and device enrollment, PIN-protected profile selection, profile
editing with effective-dated settings and day energy snapshots, and transparent BMR/TDEE/target
estimates for each profile. Pet fields are `null` until US7 (I4).

**Independent Test**: on a fresh database create profile A (gain, +300), then B (loss, −400) from
A's session; each shows different, correct BMR/TDEE/target; editing A never changes B; a wrong
PIN or recovery code ×5 locks; an unenrolled client cannot list or create profiles; changing
settings today leaves past snapshots unchanged (quickstart 1, 2, 2b, 5b, 13).

### Tests for User Story 1 ⚠️ (write first, must fail)

- [X] T025 [P] [US1] Unit tests for energy functions in `tests/unit/domain/energy.test.ts`: `ageOn`, `bmr` (Mifflin male 80/180/30 → 1780; female 65/165/28 → 1380.25; unspecified constant −78; Harris-Benedict revised formulas), `activityMultiplier`, `baselineTdee` (1780×1.55=2759), `recommendedTarget` (+300 → 3059, −400 → 2359), `targetCaution` (1150 vs BMR 1380 → target_below_safety; −800 vs 2759 → adjustment_over_25pct; null otherwise)
- [X] T127 [P] [US1] Unit tests for settings history in `tests/unit/domain/settings.test.ts`: every "settings history" example in contracts/domain-calculations.md (`effectiveSettings` before/at/after versions and same-day ties, `weightForDate` incl. the earliest-record fallback, `buildDayEnergySnapshot` values, and a snapshot built before v2 is unchanged after v2 is added)
- [X] T026 [P] [US1] Integration tests for auth in `tests/integration/auth.test.ts`: create profile returns a one-time recovery code; correct PIN creates a session; 5 wrong PINs → LOCKED with `retryAfterSec`=60, then doubling up to 15 min; 5 wrong recovery codes → LOCKED with the same escalation on its own counter; successful pin-reset rotates the code and resets both PIN and recovery counters; the session expires after 15 min of inactivity; the cookie has `Secure` only when `COOKIE_SECURE=true` and always `HttpOnly` + `SameSite=Strict`
- [X] T132 [P] [US1] Integration tests for setup protection in `tests/integration/setup-protection.test.ts`: with 0 profiles, anonymous `POST /profiles` succeeds and enrolls the device; with ≥ 1 profile, anonymous create → FORBIDDEN, wrong setupToken → FORBIDDEN and 5 failures → RATE_LIMITED, valid setupToken → 201, an authenticated session → 201; `GET /profiles/selector` and `POST /session` without a device cookie → DEVICE_NOT_ENROLLED; `GET /setup/status` reveals only the two booleans; pairing code enrolls once and expires after 10 min; revoked device is rejected; the SETUP_TOKEN value never appears in any response body or client bundle (grep of `.next/static`)
- [X] T027 [P] [US1] Integration tests for profile isolation in `tests/integration/profile-isolation.test.ts`: `PATCH /me` as A leaves B unchanged; `GET /profiles/selector` exposes only id/name and null pet fields; adjustment sign validated against goal type
- [X] T128 [P] [US1] Integration tests for settings history in `tests/integration/settings-history.test.ts`: `PATCH /me` with an energy-relevant change creates a settings version effective today and returns `appliedFrom`; two changes on the same day → the latest wins; today's snapshot is refreshed; a snapshot for a past date stays identical; a non-energy change (name, units) creates no version; `GET /me/settings-history` lists versions

### Implementation for User Story 1

- [X] T028 [US1] Implement `src/domain/energy/index.ts` (`ageOn`, `bmr`, `activityMultiplier`, `baselineTdee`, `recommendedTarget`, `targetCaution`, `energyProfile(...)`, returning the `EnergyProfile` shape from contracts/http-api.md) until T025 passes
- [X] T130 [US1] Implement `src/domain/energy/settings.ts` (`effectiveSettings`, `weightForDate`, `buildDayEnergySnapshot`, `dayEnergyFromSnapshot`) until T127 passes
- [X] T129 [US1] Create the settings schema in `src/server/db/schema/settings.ts`: `profile_settings_version` and `day_energy_snapshot` per data-model.md (PK (profile_id, local_date) for snapshots; index (profile_id, effective_from)); generate the migration
- [X] T029 [P] [US1] Create the Zod schemas in `src/server/validation/profile.ts` (createProfile incl. optional `setupToken` and data preferences, updateProfile split into profile fields vs energy-relevant settings fields, login, pinReset, enrollDevice) with all bounds from data-model.md (age 14–100, height 100–250, weight 20–350, target 30–300, PIN `^\d{4,6}$`, adjustment −1500..1500 with sign matching goal, override 800–6000, valid IANA time zone)
- [X] T030 [P] [US1] Implement PIN hashing in `src/server/auth/pin.ts` (argon2id hash/verify for PIN, recovery code and pairing code; `generateRecoveryCode()` = 12 chars from an unambiguous alphabet, grouped XXXX-XXXX-XXXX; `generatePairingCode()` = 8 chars)
- [X] T031 [US1] Implement the lockout logic in `src/server/auth/lockout.ts`, generic over a counter kind (`pin` | `recovery`): `checkLocked(profile, kind)`, `registerFailure(profileId, kind)` → after every 5th consecutive failure set the kind's lock = now + 60 s × 2^(series−1), capped at 15 min; `registerSuccess(profileId, kind)`; on successful recovery reset both kinds; document the policy in a header comment
- [X] T133 [US1] Implement device enrollment: `device` and `pairing_code` tables in `src/server/db/schema/devices.ts` (+ migration); `src/server/auth/device.ts` (`enrollDevice(via, label, byProfileId?)` setting the `np_device` cookie with `cookieOptions()` and 180-day expiry, `requireDevice()` throwing DEVICE_NOT_ENROLLED, `issuePairingCode(profileId)`, `redeemPairingCode(code)`, `listDevices`, `revokeDevice`); `src/server/auth/rate-limit.ts` (in-memory per-IP limiter: 5 failures → 15 min, used for setup token and pairing codes)
- [X] T134 [US1] Implement `src/server/auth/setup-token.ts` (`verifySetupToken(input)`: constant-time compare against `env.SETUP_TOKEN`, rate limited, false if unset) and `canCreateProfile(ctx)` (true if 0 profiles, or there is an authenticated session, or the setup token is valid)
- [X] T131 [US1] Implement the day-energy module in `src/server/modules/day-energy/service.ts`: `ensureDaySnapshot(profileId, date)` (creates the snapshot on the first food or activity record using `effectiveSettings` + `weightForDate`; idempotent), `getDayEnergy(profileId, date)` (snapshot if present, else computed on the fly and not persisted), `refreshTodaySnapshot(profileId)` (called after settings changes made today)
- [X] T032 [US1] Implement the profiles module in `src/server/modules/profiles/service.ts`: `createProfile` (checks `canCreateProfile`; one transaction: profile + first weight_record + settings version v1 effective on the creation date; runs an `onProfileCreated` hook list that is **empty until US7**; enrolls the device during initial setup; returns the recovery code once), `getMe` (profile + latest weight + current settings + energyProfile for today), `updateMe` (profile fields update in place; energy-relevant fields insert a new settings version effective today, then `refreshTodaySnapshot`; returns CONFIRM_REQUIRED when `targetCaution` is non-null and `confirm` is not true; returns `appliedFrom`), `settingsHistory`, `listSelector` (pet fields `null` until US7 registers a pet lookup), `resetPin` (recovery lockout via T031)
- [X] T033 [US1] Implement the route handlers: `src/app/api/v1/setup/status/route.ts` (GET), `src/app/api/v1/devices/enroll/route.ts` (POST), `src/app/api/v1/devices/pairing-code/route.ts` (POST), `src/app/api/v1/devices/route.ts` (GET), `src/app/api/v1/devices/[id]/route.ts` (DELETE), `src/app/api/v1/profiles/route.ts` (POST), `src/app/api/v1/profiles/selector/route.ts` (GET, device), `src/app/api/v1/profiles/[id]/pin-reset/route.ts` (POST, device), `src/app/api/v1/session/route.ts` (POST login with device, DELETE logout), `src/app/api/v1/me/route.ts` (GET, PATCH), `src/app/api/v1/me/settings-history/route.ts` (GET)
- [X] T034 [US1] Build the profile selector + PIN pad screen in `src/app/(auth)/select/page.tsx` and `src/ui/auth/PinPad.tsx` (large keys, lockout countdown, "¿Olvidaste tu PIN?" link to the recovery form at `src/app/(auth)/recover/page.tsx`, which also shows the recovery lockout countdown); on load call `GET /setup/status` → initial setup → `/onboarding`, not enrolled → `/enroll`; render pet info only when non-null
- [X] T135 [US1] Build the enrollment screen `src/app/(auth)/enroll/page.tsx` (device label + "código de emparejamiento" or "token de configuración"; the token is posted once and never stored client-side) and a "Dispositivos" section in `src/app/(app)/perfil/page.tsx` (generate a pairing code with countdown, list and revoke devices, "Agregar perfil" entry to onboarding using the current session)
- [X] T035 [US1] Build the onboarding wizard in `src/app/(auth)/onboarding/page.tsx` (steps: datos personales → objetivo y nivel de actividad with descriptions stating "excluye el ejercicio que registres" → resumen energético → preferencias de datos (unidades, zona horaria) → PIN → show the recovery code once); show the caution dialog on CONFIRM_REQUIRED; when profiles already exist it is reachable only with a session (from perfil) or after entering the setup token
- [X] T036 [US1] Build the Profile & Settings screen in `src/app/(app)/perfil/page.tsx` (edit personal data, goal, activity level, adjustment, manual target override showing the recommended value next to it, macro targets; "Preferencias de datos": weight unit, height unit, food quantity unit, time zone (FR-007), with a note that a time-zone change applies to new records; show "aplicado desde hoy" after energy-relevant changes and link to the settings history; pet name section filled in by US7; no data export in the MVP)
- [X] T037 [US1] Build the "¿Cómo se calcula?" explanation component in `src/ui/estimates/HowCalculated.tsx` (formula name and expression, inputs, multiplier, adjustment, recommended vs active target, the settings version and its effective date; text from `es.estimates`), reachable from perfil; US3 extends it with exercise
- [X] T038 [US1] Add inactivity handling in `src/ui/auth/IdleGuard.tsx` (client: after 15 min idle or on `visibilitychange` with an expired session → `/select`); "Cambiar perfil" calls DELETE /session and clears client caches so no previous-profile data remains rendered (FR-005)

**Checkpoint**: two profiles can be created on an enrolled device, protected, edited with
reproducible history, and show their own estimates.

---

## Phase 4: User Story 2 — Log a weighed meal quickly and see the day update (Priority: P1)

**Goal**: versioned food catalog with an extensible, reproducible import (USDA FDC → FNDDS → OFF
→ TCAC if licensed), a coverage report and known gaps, accent-insensitive search, plus the daily
meal journal with snapshots and instant totals.

**Independent Test**: after `pnpm import:foods --all`, log a breakfast of guaranteed foods (huevo
entero cocido 100 g, mango 70 g, leche 200 ml, avena 40 g); per-item and totals match the hand
calculation; a re-import with changed values leaves the entries unchanged; "arepa casera" returns
no invented result (quickstart 3, 4, 4b-search, 11, 12).

### Tests for User Story 2 ⚠️ (write first, must fail)

- [X] T039 [P] [US2] Unit tests for nutrition in `tests/unit/domain/nutrition.test.ts`: all `scaleNutrients`/`sumNutrients` examples from contracts/domain-calculations.md (155 kcal ×100 g; 219 ×130 g → 284.7; milk 200 ml per-100-ml → 122; g-basis without density → approximate; density conversion both ways; unknown fiber → incomplete)
- [X] T040 [P] [US2] Property tests in `tests/unit/domain/nutrition.property.test.ts` (fast-check: scaling is linear in quantity; sum of the scaled splits of a quantity equals the scaled total within 1e-9)
- [X] T041 [P] [US2] Unit tests for import validation in `tests/unit/import/validate.test.ts` (reject missing core nutrient, negative, kcal > 900, P+C+F > 100 g, sugar > carbs; Atwater deviation > max(15%, 20 kcal) → warning not rejection)
- [X] T042 [P] [US2] Integration tests for the importer in `tests/integration/importer.test.ts` using fixtures in `tests/fixtures/import/` (first run creates foods + v1; identical rerun → created=0 updated=0; changed kcal → new food_version and moved current_version_id; alias-only change → no new version; import_run row with checksum; a fixture adapter registered through the registry imports without pipeline changes; FNDDS rows land under `usda_fndds`; OFF products keep their published names and `packaged` state)
- [X] T043 [P] [US2] Integration tests for journal snapshots in `tests/integration/journal-snapshot.test.ts` (log an entry; import a new version; the entry keeps its values and `snap_preparation_state`; editing quantity recomputes from the snapshot; changing the food re-snapshots; the first entry of a day creates its `day_energy_snapshot`; backfilling a date before the latest settings version uses the version effective then; entry of another profile → NOT_FOUND; future date → VALIDATION; > 2000 g without confirm → CONFIRM_REQUIRED; > 5000 → VALIDATION)
- [X] T044 [P] [US2] Integration tests for search in `tests/integration/food-search.test.ts` ("platano" finds "Plátano", "huevo"/"egg" find egg via alias, prefix "are" finds arroz/arepa products if present, raw and cooked variants are separate results with their state, category/state filters, hidden foods excluded, another profile's custom foods excluded, a query with no verified match returns an empty list with `suggestCustomFood: true`)

### Implementation for User Story 2

- [X] T045 [US2] Create the catalog schema in `src/server/db/schema/foods.ts`: `data_source`, `import_run`, `food`, `food_alias`, `food_version` (fields and enums from data-model.md; unique (data_source_id, source_food_id)); add the FTS5 virtual table `food_search` with tokenizer `unicode61 remove_diacritics 2` plus insert/update/delete sync triggers in a custom SQL migration `src/server/db/migrations/0001_food_search.sql`
- [X] T046 [US2] Create the journal schema in `src/server/db/schema/journal.ts`: `meal` (unique (profile_id, local_date, occasion) except `extra`, via a partial unique index) and `meal_entry` with all snapshot columns from data-model.md incl. `snap_preparation_state`; generate the migration
- [X] T047 [US2] Seed the `data_source` rows (usda_fdc, usda_fndds, tcac, off, user, user_correction with license and attribution_text from contracts/food-import-format.md) in `src/server/db/seed/data-sources.ts`
- [X] T048 [US2] Implement `src/domain/nutrition/index.ts` (`scaleNutrients`, `sumNutrients` with null propagation and an `incomplete` list) until T039–T040 pass
- [X] T049 [P] [US2] Implement the `NormalizedFood` type and validator in `scripts/importers/normalized.ts` and `scripts/importers/validate.ts` until T041 passes
- [X] T050 [US2] Implement the import pipeline core in `scripts/importers/pipeline.ts` (compute the input sha256, open an import_run, upsert by (source, source_food_id) creating versions only on nutrient change, sync aliases, write the report JSON to `data/import-reports/<source>-<timestamp>.json`, never touch meal_entry, never fill or copy values between foods) until T042 passes
- [X] T138 [US2] Implement the adapter registry in `scripts/importers/registry.ts` (`{ sourceId, read(inputPath): AsyncIterable<NormalizedFood> }` interface, ordered list usda_fdc → usda_fndds → off → tcac, tcac included only when `TCAC_ENABLED=true`) so new sources are added without pipeline changes (C1 extensibility)
- [X] T051 [P] [US2] Implement the USDA adapter in `scripts/importers/usda.ts`, registered twice (`usda_fdc`: Foundation + SR Legacy bulk JSON filtered by `allowlist.csv`; `usda_fndds`: Survey/FNDDS bulk JSON filtered by `allowlist-fndds.csv`), nutrient mapping 1008→2047→2048, 1003, 1005, 1004, 1079, 2000→269, 1093; sourceVersion from each file's release metadata
- [X] T052 [P] [US2] Create the USDA FDC allowlist `data/sources/usda/allowlist.csv` (columns `fdc_id,name_es,aliases_es,category,preparation_state,basis`) covering the FR-024 generic staples as separate raw and cooked variants (one row per variant): white/brown rice raw+cooked, whole egg raw/boiled/fried, chicken breast/thigh raw+cooked, beef cuts raw+cooked, tilapia/salmon/tuna, white bread, potato raw/boiled, plantain raw/cooked, red/black beans cooked, lentils cooked, whole/skim milk (basis ml), oats, a generic cheese (e.g., mozzarella/queso fresco equivalent only if the USDA description matches), common fruits (mango, banana, papaya, orange, apple, pineapple, guava, strawberry), common vegetables (tomato, onion, carrot, lettuce, cucumber, broccoli, avocado), oils, sugar; every `name_es` must translate the USDA description faithfully (no renaming to a different dish); add `data/sources/usda/README.md` documenting download URLs, release dates and the review rule
- [X] T136 [P] [US2] Investigate FNDDS and create `data/sources/usda/allowlist-fndds.csv`: search the downloaded FNDDS release for generic foods and prepared dishes relevant to Colombian eating (e.g., arepa, plantain preparations, rice and bean dishes, soups); add a row only when the FNDDS description is the same food/dish; record the findings in `data/sources/usda/FNDDS_REVIEW.md` (searched terms, matches accepted, terms with no match → go to KNOWN_GAPS.md)
- [X] T053 [P] [US2] Implement the USDA fetch script in `scripts/fetch-usda.ts` (downloads the pinned Foundation, SR Legacy and FNDDS bulk JSON release zips to `data/sources/usda/`, verifies their sizes, prints the sha256 values)
- [X] T054 [P] [US2] Implement the TCAC adapter in `scripts/importers/tcac.ts` (reads `data/sources/tcac/foods.csv`, rejects rows with empty `verified_by`, skipped entirely unless `TCAC_ENABLED=true`) and create the CSV with header only plus `data/sources/tcac/README.md` explaining the transcription and double-entry process and the pending license check (research R6.2)
- [X] T055 [P] [US2] Implement the OFF fetch script in `scripts/fetch-off.ts` (API v2 search, `countries_tags_en=colombia`, fields limited to the needed nutriments, ≤ 10 requests/min throttle, `User-Agent` from env, writes `data/sources/off/snapshot-<date>.jsonl`) and the adapter `scripts/importers/off.ts` (packaged/branded products only; product names kept as published and never relabeled as homemade dishes; kcal fallback energy_100g/4.184, sodium g→mg ×1000, basis ml when nutrition_data_per=100ml or the quantity unit is ml/l, preparationState packaged, brand = first brand, category mapping with fallback `empacados`, skip incomplete products and list them in the report)
- [X] T056 [US2] Implement the CLI entry in `scripts/import-foods.ts` (`--source`, `--all` in registry order, `--input`, `--dry-run`; prints a summary table)
- [X] T137 [US2] Implement the coverage report: `data/sources/coverage-list.csv` (FR-024 items with search terms incl. `arepa|casera`, `queso campesino`, `patacón`), `data/sources/KNOWN_GAPS.md` (initial gaps: arepa (casera), Colombian fresh cheeses, patacón and other homemade preparations, each with reason, candidate future source, and "use a custom food meanwhile"), and `scripts/import-coverage.ts` (writes `data/import-reports/coverage-<date>.json`, exits non-zero if a missing item is not in KNOWN_GAPS.md), with an integration test in `tests/integration/import-coverage.test.ts`
- [X] T057 [US2] Implement the foods read module in `src/server/modules/foods/service.ts`: `searchFoods(profileId, { q, category, state, branded, limit })` (FTS prefix query on accent-stripped tokens, excludes hidden foods and other profiles' custom foods, ranks by FTS rank then source priority tcac > usda_fdc > usda_fndds > off; returns `suggestCustomFood: true` when there are no results), `getFood(profileId, id)` resolving the effective version (extended by US4 for overrides), `listSources()` until T044 passes
- [X] T058 [US2] Implement the route handlers `src/app/api/v1/foods/route.ts` (GET search), `src/app/api/v1/foods/[id]/route.ts` (GET detail), `src/app/api/v1/sources/route.ts` (GET)
- [X] T059 [P] [US2] Create the Zod schemas in `src/server/validation/journal.ts` (addEntry, batchEntries, updateEntry, duplicateMeal, template create/apply, dayFlags) with quantity > 0 ≤ 5000, `confirm` required above 2000, date not in the future (in the profile's time zone), `label` required for `extra`; no separate preparation-state input (it comes from the food variant)
- [X] T060 [US2] Implement the journal module in `src/server/modules/journal/service.ts`: `addEntry` (resolve local_date in the profile's time zone, call `ensureDaySnapshot` (T131), find or create the meal, resolve the effective food version, `scaleNutrients`, write snapshot fields incl. `snap_preparation_state`), `addBatch`, `updateEntry` (recompute from the snapshot; re-snapshot when foodId changes), `deleteEntry`, `duplicateMeal`, and `getDaySummary(profileId, date)` returning the `DaySummary` from contracts/http-api.md (meals, per-meal and day totals via `sumNutrients`, incompleteNutrients, target.remainingKcal from `getDayEnergy` (T131) for that date; `estimates` filled in by US3, `status` (null until then) by US6, `xpAwarded` by US7 through extension points that return neutral values for now) until T043 passes
- [X] T061 [US2] Implement the meal templates in `src/server/db/schema/templates.ts` (`meal_template`, `meal_template_item`) and `src/server/modules/journal/templates.ts` (create from a meal or from items, list, delete, apply = addBatch with current/effective versions)
- [X] T062 [US2] Implement the route handlers: `src/app/api/v1/days/[date]/route.ts` (GET), `src/app/api/v1/days/[date]/entries/route.ts` (POST), `src/app/api/v1/days/[date]/entries/batch/route.ts` (POST), `src/app/api/v1/entries/[id]/route.ts` (PATCH, DELETE), `src/app/api/v1/meals/[mealId]/duplicate/route.ts` (POST), `src/app/api/v1/templates/route.ts` (GET, POST), `src/app/api/v1/templates/[id]/route.ts` (DELETE), `src/app/api/v1/templates/[id]/apply/route.ts` (POST)
- [X] T063 [US2] Build the food search component in `src/ui/foods/FoodSearch.tsx` (debounced 150 ms search-as-you-type, results with name, preparation state chip, source badge (USDA / FNDDS / OFF / TCAC / propio), kcal/100; keyboard friendly; autofocus; a "sin resultados verificados" empty state, which US4 (T140) extends with the custom-food action)
- [X] T064 [US2] Build the quantity entry sheet in `src/ui/journal/QuantitySheet.tsx` (header shows the selected variant with its preparation state, e.g. "Arroz blanco · cocido", plus a one-tap switch to sibling variants of the same food when they exist; the state belongs to the variant, not to a separate field (U4); numeric keypad input in the food's basis unit with a g/ml toggle (or oz/fl oz per `food_unit`), live per-item nutrient preview computed client-side with `scaleNutrients` from `src/domain`, "aproximado" badge when converted without density, confirm button; flow search → select → grams → confirm in ≤ 4 interactions per SC-001)
- [X] T065 [US2] Build the Food Journal screen in `src/app/(app)/diario/page.tsx` with date navigation (`?date=`), meal-occasion sections (Desayuno, Media mañana, Almuerzo, Algo, Cena, Adicional + label) showing entries with their preparation state, per-meal totals, and the day totals bar; optimistic updates on add/edit/delete so totals refresh immediately (FR-034); entry actions: edit quantity, delete, duplicate meal to a date and occasion, save meal as template, apply template
- [X] T066 [US2] Build the food detail view in `src/app/(app)/alimentos/[id]/page.tsx` (all nutrients per 100 g/ml, "no disponible" for unknown values, preparation state, brand, source, source id, source version) and the sources/attribution page in `src/app/(app)/alimentos/fuentes/page.tsx` (FR-028; includes the known-gaps notice from KNOWN_GAPS.md)
- [X] T067 [US2] Run the first catalog import: execute `pnpm fetch:usda`, `pnpm fetch:off`, `pnpm import:foods --all`, `pnpm import:coverage`; commit the pinned inputs (or their checksums plus README instructions if a file is too large for git, documented in `data/sources/*/README.md`); verify the report shows zero validation errors, that every FR-024 item is either found or listed in KNOWN_GAPS.md, and that "arepa casera" is listed as a gap unless a verified record was found

**Checkpoint**: a profile can search foods and log weighed meals with correct, immutable values;
coverage gaps are explicit.

---

## Phase 5: User Story 3 — Dashboard with activity logging and estimated energy balance (Priority: P2)

**Goal**: home dashboard with intake vs target, macros, estimated expenditure and balance from
the day snapshot; activity logging with MET-based, manual, or no estimate.

**Independent Test**: with known BMR/multiplier, intake 2,000 kcal plus a running entry →
expenditure = snapshot baseline + (MET − 1)·kg·h; the balance sign and label are correct; an
activity with no estimate adds 0; changing settings today leaves yesterday's balance unchanged
(quickstart 5, 5b, 14).

### Tests for User Story 3 ⚠️

- [X] T068 [P] [US3] Unit tests in `tests/unit/domain/energy-daily.test.ts`: `activityNetKcal` (MET 9.8, 66 kg, 30 min → 290.4; MET ≤ 1 → 0), `dailyEnergy` (2400/2000 → +400 deficit; 2400/2700 → −300 surplus; 2400/2400 → 0 maintenance), `dayEnergyFromSnapshot`, and a fast-check property that the balance sign always matches the label
- [X] T069 [P] [US3] Integration tests in `tests/integration/activity.test.ts` (MET estimate uses the weight in the day's energy snapshot; an activity as the first record of a day creates the snapshot; manual estimate replaces it; `none` → 0 but the entry exists; duration 0 or > 600 → VALIDATION; another profile's activity → NOT_FOUND; DaySummary.estimates reflects activities and never changes target.activeKcal)
- [X] T139 [P] [US3] Integration tests for reproducible history in `tests/integration/history-reproducible.test.ts`: log days D−3..D−1, change activity level and adjustment on D, and assert D−3..D−1 DaySummary targets, baseline TDEE, expenditure and balance are byte-identical to before while D uses the new version; backfill D−10 (before the profile's v2) → resolves v1 and stores its snapshot; editing a past weight record leaves existing snapshots unchanged; time-zone change keeps existing local dates

### Implementation for User Story 3

- [X] T070 [US3] Add `activityNetKcal` and `dailyEnergy` to `src/domain/energy/index.ts` until T068 passes
- [X] T071 [US3] Create the activity schema in `src/server/db/schema/activity.ts` (`activity_type`, `activity_entry` per data-model.md) and seed the built-in types in `src/server/db/seed/activity-types.ts` (Caminar 2.8/3.5/5.0, Correr 7.0/9.8/11.5, Natación 5.8/5.8/9.8, Ciclismo 4.0/6.8/10.0, Gimnasio/pesas 3.5/5.0/6.0, Voleibol 3.0/4.0/8.0, Baloncesto 4.5/6.5/8.0, Tenis 5.0/7.3/8.0, each with its 2024 Adult Compendium code in `compendium_code`)
- [X] T072 [P] [US3] Create the Zod schemas in `src/server/validation/activity.ts` (createActivity: duration 1–600, estimateMethod, manualKcal 0–3000 required iff manual, intensity required when method=met and the type has several METs; createActivityType)
- [X] T073 [US3] Implement the activity module in `src/server/modules/activity/service.ts` (list types for a profile, create custom type, add/update/delete entry: call `ensureDaySnapshot`, snapshot `met_used` and `weight_kg_used` from the day snapshot, compute `net_kcal`) and fill the `estimates` extension point of `getDaySummary` in `src/server/modules/journal/service.ts` from `getDayEnergy` + `dayEnergyFromSnapshot` (bmr, baselineTdee, activityNetKcal, expenditure, balance, balanceLabel, snapshot info, isEstimate) until T069 and T139 pass
- [X] T074 [US3] Implement the route handlers `src/app/api/v1/activity-types/route.ts` (GET, POST), `src/app/api/v1/days/[date]/activities/route.ts` (POST), `src/app/api/v1/activities/[id]/route.ts` (PATCH, DELETE)
- [X] T075 [US3] Build the Activity screen in `src/app/(app)/actividad/page.tsx` and `src/ui/activity/ActivityForm.tsx` (type grid with icons, duration stepper, intensity chips, estimate mode MET / "tengo mi propia estimación" / "sin estimación", live estimated kcal labeled "estimado", daily list with edit/delete)
- [X] T076 [US3] Build the dashboard widgets: `src/ui/dashboard/CalorieProgress.tsx` (intake vs active target ring with remaining/excess text), `src/ui/dashboard/MacroBars.tsx` (protein/carbs/fat vs optional targets), `src/ui/dashboard/EnergyBalanceCard.tsx` (expenditure breakdown baseline + activity, balance with the "déficit estimado / superávit estimado / mantenimiento estimado" label and a note that it is not an exact body-weight change); visually distinct colors for intake, expenditure, target (spec §5)
- [X] T077 [US3] Build the Home screen in `src/app/(app)/page.tsx`: profile name + date header (profile time zone), pet slot (placeholder card until US7), streak slot (placeholder until US6), CalorieProgress, MacroBars, EnergyBalanceCard, and two primary buttons "Agregar comida" (opens occasion picker → FoodSearch → QuantitySheet in place) and "Agregar actividad" (opens ActivityForm in a sheet), reachable in one tap (FR-081)
- [X] T078 [US3] Extend `src/ui/estimates/HowCalculated.tsx` with the exercise section (net MET formula, MET values used today, the statement that the activity level excludes logged exercise and that the target does not increase with exercise) and the day's snapshot info (settings version, effective date, weight used, "valores congelados para días pasados"); link it from EnergyBalanceCard (FR-018)

**Checkpoint**: the daily loop (log food + activity → see target and estimated balance) works
end to end with reproducible history.

---

## Phase 6: User Story 4 — Custom foods, corrections, favorites, frequent foods (Priority: P2)

**Goal**: fill catalog gaps (incl. documented gaps such as arepa casera) and cut logging
friction with quick-add lists.

**Independent Test**: create a custom food (visible only to its owner), override a catalog food
for one profile (the other keeps the original; past entries unchanged), favorite foods, see
favorites/frequent/templates in quick-add, and create "Arepa de maíz (casera)" from the
empty-search action (quickstart 4b).

### Tests for User Story 4 ⚠️

- [X] T079 [P] [US4] Integration tests in `tests/integration/custom-foods.test.ts` (custom food searchable only by its owner with source `user`; override affects only that profile's search and new entries; past entries unchanged; deleting the override reverts; favorites PUT/DELETE; frequent = top foods by entry count over 30 days; deleting a custom food used in entries hides it but keeps the entries)

### Implementation for User Story 4

- [X] T080 [US4] Create the schema in `src/server/db/schema/food-prefs.ts` (`food_override`, `food_favorite`) and generate the migration
- [X] T081 [P] [US4] Create the Zod schemas in `src/server/validation/foods.ts` (createCustomFood, updateCustomFood, override nutrients) with the food_version bounds from data-model.md
- [X] T082 [US4] Extend `src/server/modules/foods/service.ts`: `createCustomFood` (food with owner_profile_id + version v1, source `user`), `updateCustomFood` (new version), `hideCustomFood`, `setOverride`/`removeOverride` (user_correction version), effective-version resolution (override > current) used by search, detail and `journal.addEntry`, `toggleFavorite`, `quickLists(profileId)` (favorites, frequent over 30 days, templates); search ranks favorites and overrides first until T079 passes
- [X] T083 [US4] Implement the route handlers `src/app/api/v1/foods/route.ts` (add POST), `src/app/api/v1/foods/[id]/route.ts` (add PATCH, DELETE), `src/app/api/v1/foods/[id]/override/route.ts` (POST, DELETE), `src/app/api/v1/foods/[id]/favorite/route.ts` (PUT, DELETE), `src/app/api/v1/foods/quick/route.ts` (GET)
- [X] T084 [US4] Build the Food Database screen in `src/app/(app)/alimentos/page.tsx` (search + category/state/branded filters, favorites tab, "Mis alimentos" tab) and the custom food form `src/app/(app)/alimentos/nuevo/page.tsx` (basis g/ml, preparation state, required core nutrients, optional fiber/sugar/sodium left empty = unknown, a required "fuente de los valores" note (e.g., etiqueta, receta propia)); add a "Corregir valores" action and a favorite star to the food detail page `src/app/(app)/alimentos/[id]/page.tsx`
- [X] T140 [US4] Extend the FoodSearch empty state in `src/ui/foods/FoodSearch.tsx`: when `suggestCustomFood` is true, show "No hay un alimento verificado para «…». Crear alimento personalizado", which opens `/alimentos/nuevo?name=<query>` and returns to the QuantitySheet after saving; never suggests an unrelated food (FR-029)
- [X] T085 [US4] Add the quick-add panel `src/ui/journal/QuickAdd.tsx` (favorites, frequent, templates as tap targets shown before typing in FoodSearch; a food tap opens QuantitySheet prefilled with the last quantity used; a template tap applies in one action; ≤ 3 interactions per SC-002) and wire it into the Home add-meal flow and `diario`

**Checkpoint**: frequent re-logging takes ≤ 3 taps; corrections never leak across profiles or into
history; documented gaps are covered by user-created foods.

---

## Phase 7: User Story 5 — Record weight and see the trend (Priority: P3)

**Goal**: weight history CRUD, a smoothed trend chart, and the distance to target.

**Independent Test**: 10 measurements over 3 weeks → list, edit/delete, trend line,
"X kg al objetivo" based on the trend (quickstart 6).

### Tests for User Story 5 ⚠️

- [X] T086 [P] [US5] Unit tests in `tests/unit/domain/weight.test.ts` (7-day moving average over available points; trend omitted with fewer than 3 points; several records on the same day use the latest; `toTarget` from the trend weight for gain and loss goals; `trendChange7d`)
- [X] T087 [P] [US5] Integration tests in `tests/integration/weight.test.ts` (add/edit/delete; deleting the last record → CONFLICT; future date → VALIDATION; current weight = latest record; a new record is used by days whose snapshot does not exist yet, and existing past snapshots are unchanged; display in lb when `weight_unit=lb` while storage stays kg)

### Implementation for User Story 5

- [X] T088 [US5] Implement `src/domain/weight/index.ts` (`movingAverageTrend(records, windowDays=7)`, `latestOnOrBefore(records, date)`, `toTarget(trendKg, targetKg)`, `trendChange(trend, days)`) until T086 passes
- [X] T089 [US5] Implement the weight module in `src/server/modules/weight/service.ts` plus `src/server/validation/weight.ts` (list with trend and summary per contracts/http-api.md, add, update, delete with the last-record guard; never modifies day_energy_snapshot) until T087 passes
- [X] T090 [US5] Implement the route handlers `src/app/api/v1/weights/route.ts` (GET, POST) and `src/app/api/v1/weights/[id]/route.ts` (PATCH, DELETE)
- [X] T091 [US5] Build the weight UI: `src/ui/weight/WeightChart.tsx` (Recharts: raw points as dots, trend as a line, target as a dashed reference line; display units per profile) and the weight section of `src/app/(app)/progreso/page.tsx` (quick "Registrar peso" form, history list with edit/delete, summary "tendencia: −0,4 kg en 7 días · 4 kg al objetivo" with no date promise and no single-day progress messages)

**Checkpoint**: weight trends are visible and independent per profile.

---

## Phase 8: User Story 6 — Calendar and streaks (Priority: P3)

**Goal**: six unambiguous day states, rest-day and "día completo" flags, a monthly calendar with
history, day detail, streaks with lenient, backfill-safe freezes.

**Independent Test**: seed two months of mixed days (incl. activity-only days, non-consecutive
completions and late backfills) → states, frozen days, current/longest streak, total recorded and
total completed days, freezes and monthly % match the fixtures (quickstart 7–9, 8b).

### Tests for User Story 6 ⚠️

- [X] T092 [P] [US6] Unit tests in `tests/unit/domain/tracking.test.ts`: `foodCompleted` (3 occasions → true; 2 + marked → true; marked with 0 food entries → false), `dayStatus` for all 6 states (activity only → `activity_only` even with restDay; food partial + activity → `food_partial`; completed + rest → `rest_completed`; completed + activity → `full_completed`), `isCompleted`, `rewardEligible` (completed within 2 days → true; 10 days later → false; time-zone edge), `computeStreaks` with every example in contracts/domain-calculations.md (7 done + 1 missed + 1 done → current 8; non-consecutive 7 → 1 freeze; 1 freeze + 2 missed → second breaks; cap 2; non-eligible days earn no freezes; today unfinished doesn't break or consume; totalRecordedDays vs totalCompletedDays), `monthCompletionPct`
- [X] T093 [P] [US6] Property tests in `tests/unit/domain/tracking.property.test.ts` (day status and streaks are unchanged by any kcal values or targets (FR-062); freezes always within 0..2; freezes consumed ≤ freezes earned; totalCompletedDays ≤ totalRecordedDays)
- [X] T094 [P] [US6] Integration tests in `tests/integration/calendar.test.ts` (day flags PUT; status reflected in DaySummary and calendar; `first_completed_at` set on entering and cleared on leaving a completed state; backfilling a past day recomputes `streak_cache`; monthly % uses elapsed days; calendar returns `totalRecordedDays` and `totalCompletedDays`)
- [X] T141 [P] [US6] Integration tests for backfill abuse in `tests/integration/streak-backfill.test.ts` (with a controllable clock: completing 7 days by backfilling dates 10+ days old earns 0 freezes and 0 streak XP but updates calendar, totals and streak length; completing within 2 days earns them; toggling "día completo" off/on outside the window does not create eligibility)

### Implementation for User Story 6

- [X] T095 [US6] Implement `src/domain/tracking/index.ts` (`foodCompleted`, `dayStatus`, `isCompleted`, `rewardEligible`, `computeStreaks`, `monthCompletionPct`) until T092–T093 pass
- [X] T096 [US6] Create the schema in `src/server/db/schema/tracking.ts` (`day_log` incl. `first_completed_at`, `streak_cache` incl. `total_recorded_days`, `total_completed_days`, `eligible_completed_days`) and generate the migration
- [X] T097 [US6] Implement the calendar module in `src/server/modules/calendar/service.ts`: `setDayFlags`, `dayInputs(profileId, from, to)` (aggregate entry counts/occasions/activities/flags per date in one query), `updateDayCompletion(profileId, date)` (maintains `first_completed_at` on state transitions, called after every journal/activity/flag change), `recomputeStreak(profileId)` (full recompute from the first recorded date, cached in streak_cache, triggered after any change at or before `computed_through_date`), `getCalendar(month)`; fill the `status`/`foodCompleted` extension point of `getDaySummary` until T094 and T141 pass
- [X] T098 [US6] Implement the route handlers `src/app/api/v1/days/[date]/flags/route.ts` (PUT) and `src/app/api/v1/calendar/route.ts` (GET `?month=`)
- [X] T099 [US6] Build the Calendar screen in `src/app/(app)/calendario/page.tsx` with `src/ui/calendar/MonthGrid.tsx` (a distinct color and icon per state for all 6 states incl. "solo actividad", with a legend; snowflake marker for frozen days; activity marker on partial days; prev/next month navigation; today outlined), the streak stats card (current, longest, "días registrados", "días completos", freezes available, month %), and the day detail sheet `src/ui/calendar/DayDetail.tsx` reusing the DaySummary (meals, activities, totals, estimates) with a link to edit that date in `diario`
- [X] T100 [US6] Add the day flag controls to `src/app/(app)/diario/page.tsx` ("Marcar día completo" optional toggle, never prompted as mandatory; "Día de descanso" toggle) and replace the Home streak placeholder with `src/ui/dashboard/StreakBadge.tsx`
- [X] T101 [US6] Create the demo seed script `scripts/seed-demo.ts` (two profiles with opposite goals and identical logging timelines, 60 days with complete, partial, activity-only, rest, missed and frozen days, non-consecutive completions, late backfills outside the window, a settings change mid-period, weights, activities) plus its expected-output fixture `tests/fixtures/demo-expected.json` used by quickstart scenario 9

**Checkpoint**: consistency is visible; all states and streak rules are unambiguous and never
depend on targets.

---

## Phase 9: User Story 7 — Virtual cat that grows with consistency (Priority: P3)

**Goal**: an independent cat per profile with XP (capped, revocable only for deleted records),
stages, mood with a floor, treats (1 per completed day), feeding, milestones, accessories, and
goal-specific messages with identical rewards.

**Independent Test**: two profiles with opposite goals and identical actions end with identical
XP/stage/treats/freezes and different, goal-appropriate messages; caps hold; missed days never
reduce XP or stage (quickstart 10).

### Tests for User Story 7 ⚠️

- [X] T102 [P] [US7] Unit tests in `tests/unit/domain/gamification.test.ts`: `awardXp` caps (20 food entries → 10 events/20 XP), backfill window (today − 3 → null), weight spacing (3 days), streak bonus min(streak, 10) only when reward-eligible, `activityBonusXp` (completed + activity → 1; food_partial or activity_only → 0); `treatsForDay` (completed states → 1; activity_only/food_partial/none → 0); `dayRewardsToRevoke`; `stageFor` thresholds (299 → newborn, 300 → young, 5500 → special) and stage unchanged after revocation; `applyMoodDecay` floor 30; `moodOnAction`; `feed` (no treats → error; +15 capped at 100); `moodLabel`
- [X] T103 [P] [US7] Property tests in `tests/unit/domain/gamification.property.test.ts` (for random action sequences: identical XP, treats, freezes, milestones and stage for two profiles differing only in goal type and kcal; xp_total never decreases across missed days; stage never decreases under any sequence incl. deletions; treats never negative)
- [X] T142 [P] [US7] Unit tests for messaging in `tests/unit/domain/gamification-messages.test.ts`: `messageKey(event, goal)` returns a distinct key per goal; every event × {gain, loss, maintenance} key exists in `src/i18n/es.ts`; a forbidden-phrase check over all pet/milestone messages (e.g., "come más", "come menos", "salta", "ayuna", calorie numbers) finds no matches; reward functions take no goal parameter (type-level check)
- [X] T104 [P] [US7] Integration tests in `tests/integration/pet.test.ts` (pet created with the profile; profiles created before US7 get a pet via migration; logging awards XP visible in DaySummary.xpAwarded; deleting an entry revokes its XP; a day dropping out of completed revokes food_day, activity_bonus, streak XP and an unspent treat (balance never below 0); add/delete cycles cannot exceed the caps; stage never decreases after revocation; stage-up triggers a milestone unlock; B's pet is unaffected by A's actions; feeding consumes a treat; activity-only days give no treat; `GET /pet` messages differ by goal while rewards match)

### Implementation for User Story 7

- [X] T105 [US7] Implement `src/domain/gamification/index.ts` (`awardXp`, `activityBonusXp`, `treatsForDay`, `dayRewardsToRevoke`, `stageFor`, `nextStageXp`, `progressPct`, `applyMoodDecay`, `moodOnAction`, `moodLabel`, `feed`, `milestonesReached(stats)` counting only reward-eligible days for streak milestones) using `src/domain/config.ts`; no function takes goal type or kcal; until T102–T103 pass
- [X] T143 [US7] Implement goal-specific presentation: `src/domain/gamification/messages.ts` (`messageKey(event, goalType)` for events: welcome, food_day_completed, activity_logged, weight_recorded, streak milestones 7/14/30/60/100, first_full_week, each stage evolution, mood_missed_you, feed) and the message catalog under `pet.msg.{gain,loss,maintenance}.*` in `src/i18n/es.ts` (gain: sustainable progress and regular meals; loss: steady habits and consistency; maintenance: balance and keeping habits; none praising eating more or less, skipping meals, or calorie numbers) until T142 passes
- [X] T106 [US7] Create the schema in `src/server/db/schema/pet.ts` (`pet`, `xp_event` with unique (profile_id, source, source_record_id) and `activity_bonus` source, `treat_event`, `milestone`, `milestone_unlock`, `accessory`, `pet_accessory_unlock`), a data migration that creates a default pet for every existing profile (I4), and seed milestones (streaks 7/14/30/60/100, first full week, each stage; identical for all goals) and accessories (gorro, bufanda, moño, gafas, corona) in `src/server/db/seed/gamification.ts`
- [X] T107 [US7] Implement the pet module in `src/server/modules/pet/service.ts`: `createPetForProfile` (registered in the `onProfileCreated` hook list from T032, default name "Michi"; also registers the pet lookup used by `listSelector`), `onTrackingEvent(profileId, { source, recordId, loggedDate })` (award XP via the domain, update max_xp_reached/stage, mood +10, a treat when the day first reaches a completed state, activity bonus, milestone unlocks with rewards), `onRecordDeleted` and `onDayStatusChanged` (revoke the record's XP; when a day leaves a completed state, revoke its food_day/activity_bonus/streak XP and unspent treat; stage unchanged), lazy mood decay on read using mood_updated_date, `getPet` (incl. the goal-specific message via `messageKey`), `updatePet`, `feedPet`
- [X] T108 [US7] Wire the gamification hooks: call `pet.onTrackingEvent`/`onRecordDeleted` from `src/server/modules/journal/service.ts`, `src/server/modules/activity/service.ts`, `src/server/modules/weight/service.ts`, and `onDayStatusChanged` plus streak rewards after `updateDayCompletion`/`recomputeStreak` in `src/server/modules/calendar/service.ts` (streak XP and freezes only for reward-eligible days); fill the `xpAwarded` extension point of DaySummary until T104 passes
- [X] T109 [US7] Implement the route handlers `src/app/api/v1/pet/route.ts` (GET, PATCH) and `src/app/api/v1/pet/feed/route.ts` (POST)
- [X] T110 [P] [US7] Create the original cat illustrations as SVGs in `public/pet/stage-{newborn,young,adolescent,adult,special}.svg` (friendly flat style, consistent palette, a shared viewBox with documented anchor points for head/neck/face) and accessory overlays in `public/pet/acc-{gorro,bufanda,mono,gafas,corona}.svg`
- [X] T111 [US7] Build `src/ui/pet/PetCard.tsx` (stage SVG + equipped accessory overlays positioned by stage anchors, name, mood label, the current goal-specific message, XP progress bar to the next stage, treat count, "Dar premio" button with a CSS bounce animation, milestone toast `src/ui/pet/MilestoneToast.tsx` showing the goal-specific milestone text), replace the Home pet placeholder with a compact PetCard that keeps the nutrition widgets visible (FR-077), and show "+XP" feedback after logging
- [X] T112 [US7] Build the pet screen at route `/mascota` in `src/app/(app)/mascota/page.tsx` (listed in plan.md structure and FR-080): full PetCard, evolution path with thresholds visible, an accessory wardrobe to equip unlocked items, milestone history with goal-specific texts, an "¿Cómo gana experiencia?" panel listing XP sources, daily caps, treat rule, backfill window and the statement that rewards are the same for every goal; add the pet name/configuration section to `src/app/(app)/perfil/page.tsx`
- [X] T144 [US7] Write `docs/gamification-messaging.md` (tone per goal, forbidden phrasings, the requirement that every event has three goal variants, the equivalence rule for rewards, and a review checklist applied to `pet.msg.*` before release)

**Checkpoint**: each profile's cat reflects only that profile's consistency, with fair rewards and
goal-appropriate messages.

---

## Phase 10: User Story 8 — Progress summaries (Priority: P4)

**Goal**: weekly/monthly averages for intake, expenditure, balance, plus an intake trend chart.

**Independent Test**: 30 days of seeded data → averages computed over days with data only, shown
as "basado en N de M días", using the dashboard's sign convention and each day's snapshot.

### Tests for User Story 8 ⚠️

- [X] T113 [P] [US8] Unit tests in `tests/unit/domain/progress.test.ts` (`periodSummary`: averages only over days with food entries, daysWithData/daysInPeriod, balance label consistent with `dailyEnergy`, empty period → nulls)

### Implementation for User Story 8

- [X] T114 [US8] Implement `src/domain/progress/index.ts` (`periodSummary(days)`) until T113 passes, and `src/server/modules/progress/service.ts` (builds per-day intake/expenditure for the week/month ending at `end` from each day's energy snapshot, reusing the journal and activity aggregates)
- [X] T115 [US8] Implement the route handler `src/app/api/v1/progress/route.ts` (GET `?period=week|month&end=`)
- [X] T116 [US8] Add the summaries section to `src/app/(app)/progreso/page.tsx` (week/month toggle, average intake vs target, average estimated balance with label, "basado en N de M días", intake bar chart `src/ui/progress/IntakeChart.tsx` with the target line; every energy figure labeled "estimado")

**Checkpoint**: all user stories are implemented.

---

## Phase 11: Polish & Cross-Cutting Concerns

- [X] T117 [P] Cross-profile authorization sweep in `tests/integration/authorization-sweep.test.ts`: for every route in `src/app/api/v1/**` that takes a record id, call it as profile B with profile A's ids and assert NOT_FOUND; for every route, call without a session and assert UNAUTHENTICATED (except the public and device-only routes); **unauthorized creation**: anonymous `POST /profiles` with ≥ 1 profile → FORBIDDEN, wrong `setupToken` → FORBIDDEN then RATE_LIMITED; **profile discovery**: `GET /profiles/selector`, `POST /session`, `POST /profiles/{id}/pin-reset` without an enrolled device → DEVICE_NOT_ENROLLED and no names in the body; `GET /setup/status` body has exactly two boolean keys; SC-005
- [X] T118 [P] E2E tests in `tests/e2e/`: `onboarding.spec.ts` (initial setup, second profile from a session, PIN, lockout), `enrollment.spec.ts` (second browser context must enroll with a pairing code), `log-breakfast.spec.ts` (search "huevo" → variant → 100 g → totals; time the flow ≤ 20 s per item), `arepa-gap.spec.ts` (search "arepa casera" → empty state → create custom food → log 130 g), `activity-balance.spec.ts`, `calendar-streak.spec.ts` (with `seed:demo`), `profile-switch.spec.ts` (back button shows no previous data)
- [X] T119 [P] Create the Docker deployment: `Dockerfile` (multi-stage, Node 22 alpine, `next build` standalone output, non-root user, `DATABASE_PATH=/data/nutripet.db`, `COOKIE_SECURE=true`), `docker-compose.yml` (app + Caddy with HTTPS, `./data` volume, `SETUP_TOKEN` from an env file not committed), `Caddyfile`
- [X] T120 [P] Implement backups in `scripts/backup-db.ts` (`VACUUM INTO data/backups/nutripet-<date>.db`, keep the last 14) and write `docs/operations.md` (deployment, nightly backup schedule, restore, SETUP_TOKEN generation and rotation, revoking devices, COOKIE_SECURE per environment, PIN reset with `pnpm admin:reset-pin`)
- [X] T121 [P] Implement the operator PIN reset in `scripts/admin-reset-pin.ts` (`--profile <name>`; sets a new PIN typed at the terminal, rotates the recovery code, resets both lockouts, prints no profile data)
- [X] T122 [P] Write the calculation documentation `docs/calculations.md` (BMR formulas, multipliers, net MET, target, balance sign convention, safety caution, nutrient scaling, density rule, settings versions and day energy snapshots incl. backfill resolution, trend smoothing, the 6 day states, completion, total recorded vs completed days, streaks/freezes incl. the reward-eligibility window, XP/treats/revocation/stages/mood), with every number matching `src/domain/config.ts` and `CALC_VERSION` (Constitution III)
- [X] T145 [P] Write `docs/data-sources.md` (source order USDA FDC → FNDDS → OFF (packaged only) → TCAC (license pending, `TCAC_ENABLED`), licenses and attribution texts, update and re-import procedure, the no-substitution rule, the FNDDS review summary, and a link to `data/sources/KNOWN_GAPS.md` incl. "arepa (casera)")
- [X] T123 [P] Write `README.md` (purpose, setup per quickstart.md incl. `.env` variables and the LAN dev note, scripts, links to `docs/calculations.md`, `docs/data-sources.md`, `docs/gamification-messaging.md`, `docs/operations.md`, TCAC flag status, deployment summary)
- [X] T124 Accessibility and mobile pass across `src/app/(app)/**` and `src/ui/**`: touch targets ≥ 44 px, color is never the only status indicator in the calendar (icons for all 6 states), labels on inputs, no horizontal scroll at 360 px (SC-010)
- [X] T125 Performance check per the plan/research definition: run 200 representative 1–3-token queries against `GET /foods?q=` with a 10k-food catalog (pad with fixture foods if the import is smaller) and assert p95 handler time ≤ 100 ms; measure the dashboard request with `seed:demo` data (p95 ≤ 200 ms); script in `scripts/perf-check.ts`; add any missing indexes (profile_id + local_date on meal, meal_entry, activity_entry, weight_record, xp_event, day_energy_snapshot) in a new migration under `src/server/db/migrations/`
- [X] T126 Run the full quickstart.md validation (setup, `pnpm test`, `pnpm test:e2e`, `pnpm import:coverage`, manual scenarios 1–14 incl. 2b, 4b, 5b, 8b) and record the results in `specs/001-nutripet-mvp/checklists/mvp-validation.md`

---

## Phase 12: User Story 9 — Multi-food meals and homemade preparations (Priority: P2)

**Goal**: register a whole meal with many foods in one save, edit it as a whole, and build
preparations (beverages, dishes) whose nutrients are the sum of their ingredients, logged whole,
by servings or by an amount of the real final yield, with immutable history.

**Independent Test**: quickstart 15 and 16; `tests/unit/domain/recipe.test.ts`,
`tests/integration/meals-recipes.test.ts`, `tests/integration/migration-recipes.test.ts`.

### Tests for User Story 9 ⚠️ (write first, must fail)

- [X] T146 [P] [US9] Unit tests in `tests/unit/domain/recipe.test.ts` for every preparation example in contracts/domain-calculations.md § preparations: powder in water and in milk, different powder and liquid quantities, zero-calorie water, a nonzero liquid, three ingredients, whole/partial/servings portions, yield different from the ingredient sum, no per-100 without yield, invalid/missing references and quantities (with the failing ingredient index), homogeneous vs non-homogeneous, same total but lower concentration with more water; property: portions of the yield add up to the total (FR-039, FR-045, SC-012)
- [X] T147 [P] [US9] Integration tests in `tests/integration/meals-recipes.test.ts`: batch-save a 3-food meal (row/meal/day totals, remaining kcal, energy balance, calendar), atomic rejection of zero/negative/unknown items, `PUT /meals/{id}` editing (change quantity, remove, add; kept entry keeps its snapshot after a catalog update; foreign entry → 404; other profile → 404), multi-food template create/apply; water searchable once with 0 values; lemonade 80 kcal / 200 ml → 50 kcal; whole vs servings with milk; amount without yield → `yield_unknown`; non-homogeneous → `not_homogeneous`; recipe validation; recipe privacy; recipe update does not change logged entries and a portion edit uses the logged version; catalog update changes neither the recipe version nor the entry; templates/duplicates with recipe portions (FR-035a, FR-035b, FR-046, FR-047)
- [X] T148 [P] [US9] Migration test in `tests/integration/migration-recipes.test.ts`: a database at 0008 with a meal entry and a template item migrates to 0009 with identical values, `kind = 'food'`, and no foreign-key violations (FR-033)

### Implementation for User Story 9

- [X] T149 [US9] Implement `src/domain/nutrition/recipe.ts` (`ingredientContribution`, `computePreparation`, `portionFactor`, `portionNutrients`, `scaleBy`, `isValidReference`, `NutritionError`) and split the existing functions into `src/domain/nutrition/scale.ts` (re-exported from `index.ts`) until T146 passes (FR-039, FR-045)
- [X] T150 [US9] Schema in `src/server/db/schema/recipes.ts` (`recipe`, immutable `recipe_version`, `recipe_ingredient` with snapshot columns), recipe-aware `meal_entry` (`kind`, nullable food refs, `recipe_id`, `recipe_version_id`, `portion_mode`, `portion_servings`, `portion_factor`, `snap_product_form`, nullable quantity/unit and per-100 snapshot) and `meal_template_item` (food or recipe portion), `food.product_form` + `preparation_instructions`; generate `src/server/db/migrations/0009_recipes.sql` and hand-fix its data copy so existing rows keep their values (T148) (FR-038, FR-046, FR-048)
- [X] T151 [P] [US9] Add the `reference` data source and the idempotent water seeder `src/server/db/seed/reference-foods.ts` (Agua: ml basis, density 1, zero energy/macros/fiber/sugar, sodium unknown); scope `tests/integration/importer.test.ts` to imported sources (FR-047, FR-048)
- [X] T152 [P] [US9] Zod schemas: `portionSchema`, `mealItemSchema` (food or recipe portion), `updateMealSchema`, `portion` on `updateEntrySchema`, recipe items in batch/templates in `src/server/validation/journal.ts`; `recipeSchema` (yield quantity and unit together) in `src/server/validation/recipes.ts`; `productForm`/`preparationInstructions` in `src/server/validation/foods.ts` (FR-035a, FR-038, FR-083)
- [X] T153 [US9] Recipes module `src/server/modules/recipes/service.ts` (create = version 1, update = new version re-snapshotting ingredients from their effective versions, soft delete, get current or a given version incl. hidden recipes, list; domain errors → `VALIDATION` with `reason`) and routes `src/app/api/v1/recipes/route.ts`, `src/app/api/v1/recipes/[id]/route.ts` (FR-038, FR-046)
- [X] T154 [US9] Extend `src/server/modules/journal/service.ts`: food or recipe items in `addEntry`/`addBatch` with a full precheck before writing; recipe entries = version totals × portion factor with per-100-of-yield snapshot; `recompute` from the entry's own snapshot or recipe version; `updateMeal` (keep/add/remove in one transaction); recipe portions in `mealItems`/`duplicateMeal`; `kind`, `productForm`, `recipe` in `EntryView`; route `src/app/api/v1/meals/[mealId]/route.ts` (PUT) (FR-035a, FR-045, FR-046)
- [X] T155 [US9] Extend templates in `src/server/modules/journal/templates.ts` to store and apply recipe portions; add `GET /templates/{id}` in `src/app/api/v1/templates/[id]/route.ts`; exclude recipe entries from frequent foods in `src/server/modules/foods/custom.ts` (FR-035b)
- [X] T156 [US9] Expose `productForm` and `preparationInstructions` in `src/server/modules/foods/service.ts` (`FoodSummary`, search SQL, `getFood`) and `custom.ts` (FR-048)
- [X] T157 [US9] Client draft model `src/ui/journal/draft.ts` (food and recipe rows, row nutrients and meal totals through the domain functions only, API item mapping, entry label) and UI types in `src/ui/types.ts` (FR-035a, FR-039)
- [X] T158 [US9] Meal builder in `src/ui/journal/AddFoodFlow.tsx`: occasion, rows with name/qty/unit/kcal/P/C/F and edit/remove, inline search with quick-add and saved preparations, live meal total, single save (batch or `PUT /meals/{id}`), large-quantity confirmation, load template into the draft, "also save as template", discard confirmation (FR-035a, FR-035b, SC-011)
- [X] T159 [US9] Recipe builder `src/ui/recipes/RecipeBuilder.tsx` (ingredients via search + QuantitySheet, "+ Agua", servings, final yield with unit and help text, homogeneous flag, notes, live total/per serving/per 100 of yield, save, edit = new version, variation, delete) and portion picker `src/ui/recipes/PortionPicker.tsx` (whole/servings/amount only when allowed, consumed vs complete kcal, "register the ingredients I ate") (FR-038, FR-045, FR-049)
- [X] T160 [US9] Journal screen `src/app/(app)/diario/page.tsx`: recipe entries show their portion and open the portion editor against their logged version; meal actions "Editar comida completa"; `src/ui/calendar/DayDetail.tsx` portion labels (FR-046, FR-049)
- [X] T161 [P] [US9] Dry-mix/concentrate warning with "Preparar con líquido" in `src/ui/journal/QuantitySheet.tsx`, product form + instructions on `src/app/(app)/alimentos/nuevo/page.tsx` and the food detail page (FR-048)
- [X] T162 [P] [US9] Spanish strings for the builder, preparations, portions and product forms in `src/i18n/es.ts`
- [X] T163 [P] [US9] E2E: update the breakfast and arepa flows for the builder and add "multi-food meal with a preparation" in `tests/e2e/mvp.spec.ts` (SC-011)
- [X] T164 [P] [US9] Documentation: spec (US9, FR-035a/b, FR-038/039/045–049, SC-011/012, entities, edge cases), data-model, http-api, domain-calculations, plan, quickstart 15–16, `docs/calculations.md` § Preparations, `docs/data-sources.md` § Reference records
- [X] T165 [US9] Validation: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e`; quickstart 4 (single-food path still works), dashboard totals and energy balance unchanged in meaning, historical entries unchanged

### Requirement traceability (US9)

| Requirement | Tasks | Tests |
|---|---|---|
| FR-035a multi-item meal builder, whole-meal save and edit | T152, T154, T157, T158, T160 | T147, T163 |
| FR-035b templates with all items | T150, T155, T158 | T147 |
| FR-038 preparations: create/edit/reuse/variations/delete | T150, T153, T159 | T147 |
| FR-039 ingredient-based calculation in the domain | T149, T153, T157 | T146 |
| FR-045 portions, yield, homogeneous rule | T149, T152, T154, T159 | T146, T147 |
| FR-046 immutable recipe versions, historical integrity | T150, T153, T154, T160 | T147, T148 |
| FR-047 water / zero-value reference records | T151, T159 | T146, T147 |
| FR-048 product form, separate dry/prepared records, no overwrite or duplicates | T150, T151, T156, T161 | T147 |
| FR-049 log preparation portions; always show composition and consumed vs total kcal | T154, T159, T160 | T147, T163 |
| SC-011 / SC-012 | T158 / T146–T148 | T163 / T146–T148 |

**Checkpoint**: a whole meal (foods + preparation portions) is saved and edited in one action;
preparations calculate from their ingredients; history never changes.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup; BLOCKS all stories.
- **US1 (Phase 3)**: depends on Foundational. Every other story needs a profile, session, enrolled
  device and the day-energy module (T131). US1 does **not** depend on any pet table (I4).
- **US2 (Phase 4)**: depends on US1 (session, `ensureDaySnapshot`/`getDayEnergy` for
  target.remainingKcal). The catalog/import tasks T045, T047, T049–T056, T136–T138 depend only on
  Foundational and may start in parallel with US1.
- **US3 (Phase 5)**: depends on US2 (DaySummary, journal) and T131.
- **US4 (Phase 6)**: depends on US2 (catalog, journal, FoodSearch empty state T063). Independent of
  US3.
- **US5 (Phase 7)**: depends on US1 only (weight_record since T016, snapshots since T131). Can run
  in parallel with US2–US4.
- **US6 (Phase 8)**: depends on US2 (entries) and US3 (activities, for the full/rest/activity-only
  states).
- **US7 (Phase 9)**: depends on US6 (day status, reward eligibility, streaks) and hooks into
  US1 (`onProfileCreated`, selector pet lookup) and US2/US3/US5 services.
- **US8 (Phase 10)**: depends on US3 (expenditure from snapshots). Independent of US6/US7.
- **Polish (Phase 11)**: after the desired stories are complete. T117 needs US1–US7 routes.
- **US9 (Phase 12)**: depends on US2 (journal, snapshots, templates) and US4 (custom foods, quick
  lists). T146–T148 and T149 first; T150 → T151/T152 → T153 → T154 → T155; UI T157 → T158–T161.

```text
Setup → Foundational → US1 ─┬─► US2 ─┬─► US3 ─┬─► US6 ─► US7
                            │        │        └─► US8
                            │        └─► US4
                            └─► US5
   (catalog/import T045, T047, T049–T056, T136–T138 can start right after Foundational)
```

### Within each story

Tests (must fail) → domain functions → schema/migrations → services → routes → UI.
Services that edit a shared file (`journal/service.ts`, `foods/service.ts`, `energy/index.ts`,
`src/i18n/es.ts`, `perfil/page.tsx`, `FoodSearch.tsx`) are sequential across stories, not [P].
Within US1: T129 → T131 → T032; T133 → T134 → T032 → T033.

## Parallel Examples

**Phase 1**: T003, T004, T005, T006, T008, T009 together after T001–T002.

**Phase 2**: T012, T019, T020, T022, T024 alongside the T010→T011→T013→T014→T015→T016→T017→T018 chain.

**US1**: T025, T127, T026, T132, T027, T128 (tests) together; then T029 and T030 in parallel with
T028/T130.

**US2**: T039–T044 (all tests) together; T049, T051, T052, T136, T053, T054, T055 (adapters/data)
in parallel once T045, T050 and T138 exist; T059 in parallel with T057.

**US3**: T068, T069, T139 together; T072 in parallel with T070/T071.

**US5 alongside US2–US4**: T086–T091 by a second developer.

**US6**: T092, T093, T094, T141 together.

**US7**: T110 (SVG art) can start any time after Setup; T102, T103, T142, T104 together; T144 in
parallel with T105–T112.

**Polish**: T117–T123 and T145 all [P].

## Implementation Strategy

### MVP first (US1 + US2)

1. Phases 1–2 (foundation).
2. US1: protected setup, devices, profiles, PIN, settings history, estimates. **Stop and
   validate** quickstart 1, 2, 2b, 13.
3. US2: catalog import (FDC, FNDDS, OFF), coverage report + KNOWN_GAPS, meal journal. **Stop and
   validate** quickstart 3, 4, 4b (search part), 11, 12.
   → This is the first usable release: both people can log weighed meals daily with correct,
   reproducible numbers. Documented gaps (arepa casera) are logged as custom foods once US4 lands.

### Incremental delivery

4. US3 → dashboard and energy balance (the daily loop is complete).
5. US4 → quick-add and custom foods (closes the known-gap workflow; prioritize if arepa casera is
   eaten daily).
6. US5 → weight trend.
7. US6 → calendar and streaks.
8. US7 → the cat (relies on US6 states and reward eligibility).
9. US8 → summaries.
10. Polish → deployment, docs, full validation.

Each checkpoint is a deployable increment. Run `pnpm test` at every checkpoint (Constitution §7).
