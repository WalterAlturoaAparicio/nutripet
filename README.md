# NutriPet

A personal nutrition and activity tracker for several independent profiles on one shared app,
with a virtual cat that grows with **consistent tracking**: not with eating more or less. Spanish
UI (es-CO), mobile-first PWA.

- Weighed meals (g/ml) from a versioned catalog (USDA FDC + FNDDS, Open Food Facts; Colombian ICBF
  table once licensed), custom foods, corrections, favorites and templates.
- Transparent estimates: BMR (Mifflin-St Jeor), TDEE, net exercise (MET − 1), a target that does not
  move with exercise, and the energy balance. Everything is labeled "estimado", with a "¿Cómo se
  calcula?" view.
- Reproducible history: logged foods and each day's energy inputs are frozen, so catalog or settings
  changes never rewrite past days.
- Calendar with six day states, streaks with lenient freezes, weight trend, weekly/monthly
  summaries.
- Per-profile PIN, device enrollment, protected profile creation, lockouts.

Specification and design: `specs/001-nutripet-mvp/` (spec, plan, data model, contracts, quickstart).

## Setup

Requirements: Node 22, pnpm 10+.

```text
pnpm install
cp .env.example .env          # set SESSION_SECRET and SETUP_TOKEN (≥ 32 random chars)
pnpm db:migrate
pnpm fetch:usda               # pinned USDA releases (~300 MB of JSON, not committed)
OFF_USER_AGENT="NutriPet/0.1 (personal project)" pnpm fetch:off
pnpm import:foods --all
pnpm import:coverage
pnpm dev                      # http://localhost:3000
```

**Phone on the same network (development)**: run `pnpm dev --hostname 0.0.0.0` and open
`http://<pc-ip>:3000`. With `COOKIE_SECURE=false` login works over HTTP, while cookies stay
`HttpOnly` + `SameSite=Strict`. Installing as a PWA needs HTTPS or `localhost`; use the Docker
setup to test installation.

Optional demo data: `pnpm seed:demo` creates "Demo Ana" (PIN 1111) and "Demo Bruno" (PIN 2222)
with 60 days of history.

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js app |
| `pnpm test` | Vitest: domain unit + property tests, integration tests on temporary SQLite |
| `pnpm test:e2e` | Playwright (390×844 mobile viewport) |
| `pnpm lint` / `typecheck` | ESLint (domain purity rules) / TypeScript |
| `pnpm db:migrate` | apply migrations and seeds |
| `pnpm fetch:usda` / `fetch:off` | download pinned source data |
| `pnpm import:foods --all` | reproducible, idempotent catalog import |
| `pnpm import:coverage` | FR-024 coverage report vs. known gaps |
| `pnpm seed:demo` | demo profiles |
| `pnpm backup:db` | consistent SQLite backup (keeps 14) |
| `pnpm admin:reset-pin --profile "<nombre>"` | operator PIN reset |

## Documentation

- [docs/calculations.md](docs/calculations.md): every formula, constant and rule.
- [docs/data-sources.md](docs/data-sources.md): sources, licenses, import process, known gaps.
- [docs/gamification-messaging.md](docs/gamification-messaging.md): goal-specific messages with
  equal rewards.
- [docs/operations.md](docs/operations.md): deployment, backups, devices, setup token, PIN reset.

## Data source status

- **USDA FoodData Central** (CC0): active.
- **Open Food Facts** (ODbL, credited in-app): active, packaged products only.
- **ICBF Colombian table**: **disabled** (`TCAC_ENABLED=false`) until its reuse license is verified.
  Homemade arepa and other Colombian preparations are documented gaps; log them as custom foods.

## Deployment

```text
cp .env.example .env.production   # COOKIE_SECURE=true, secrets, DOMAIN
docker compose up -d --build      # app + Caddy with automatic HTTPS; migrations run at startup
```

See [docs/operations.md](docs/operations.md).
