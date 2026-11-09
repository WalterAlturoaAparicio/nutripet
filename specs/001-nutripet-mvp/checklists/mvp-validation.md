# MVP Validation Record (T126)

**Date**: 2026-11-08 (UTC 2026-11-09)
**Feature**: [spec.md](../spec.md) · [quickstart.md](../quickstart.md)

## Automated checks

| Check | Result |
|---|---|
| `pnpm lint` | ✅ clean (incl. domain-purity import rules) |
| `pnpm typecheck` | ✅ clean |
| `pnpm test` (Vitest) | ✅ 186 tests, 32 files: domain unit + property tests, integration tests on temporary SQLite |
| Domain line coverage | ✅ 98.2% (threshold 95%) |
| `pnpm build` | ✅ production build |
| `pnpm test:e2e` (Playwright, 390×844) | ✅ 10/10 flows, ~15 s |
| `scripts/perf-check.ts` (10k foods, 60-day history) | ✅ search p95 6.6 ms (≤ 100), day summary p95 2.8 ms (≤ 200) |
| `pnpm import:foods --all` | ✅ usda_fdc 136, usda_fndds 15 (0 rejected); off 1,525 imported, 205 incomplete skipped, 41 inconsistent rejected (crowd-sourced data, excluded and reported); tcac disabled. Rerun: 0 created / 0 updated (idempotent) |
| `pnpm import:coverage` | ✅ every FR-024 item found or documented in KNOWN_GAPS.md |
| Startup migrations on an empty DB (`pnpm start`) | ✅ 36 tables, seeds applied |

## Quickstart scenarios

| # | Scenario | Verified by |
|---|---|---|
| 1 | Two profiles, different goals and estimates, recovery code once | e2e `initial setup…`, `a second profile…`; integration `auth`, `profile-isolation` |
| 2 | PIN and recovery lockouts | e2e `five wrong PINs…`; integration `auth` (escalation to 15 min, separate counters) |
| 2b | Unenrolled device: no names, enrollment by pairing code / token | e2e `a new device must enroll…`; integration `setup-protection`, `authorization-sweep` |
| 3 | Accent-insensitive search, variants with preparation state and source badge | integration `food-search` |
| 4 | Breakfast totals = (quantity / 100) × per-100 | integration `journal-snapshot`; e2e timed logging (< 20 s, ~0.75 s) |
| 4b | "arepa casera": no invented result → custom food → log 130 g | e2e `homemade arepa…`; integration `food-search`, `custom-foods` |
| 5 | Activity: net MET, "sin estimación" adds 0, balance sign | integration `activity`; e2e `an activity raises…` |
| 5b | Settings change keeps past days identical | integration `history-reproducible`, `settings-history` |
| 6 | Weight history, trend, edits keep past snapshots | integration `weight`, `history-reproducible` |
| 7–8, 8b | Day states incl. "día completo" and activity-only | integration `calendar`; unit `tracking` |
| 9 | Demo timeline: streaks, freezes, totals, monthly % | integration `demo-seed` against hand-derived `tests/fixtures/demo-expected.json`; `pnpm seed:demo` ran on the real catalog |
| 10 | Pets independent; equal rewards, goal-specific messages | integration `pet`; property test `gamification.property` |
| 11 | Catalog update keeps logged values | integration `journal-snapshot`, `importer` |
| 12 | Works offline from the local catalog | by design: imports read pinned local files and search is local SQLite (no runtime network calls). Not exercised with a disconnected network |
| 13 | Switch profile + Back shows no previous data | e2e `switching profile…` |
| 14 | "¿Cómo se calcula?" with formula, inputs, MET, settings version | component rendered on home/perfil; contents covered by `history-reproducible` (snapshot info). Visual check not automated |

## Not verified in this run

- **Docker image build** (`docker compose up --build`): the Docker daemon was not running on this
  machine. `Dockerfile`, `docker-compose.yml` and `Caddyfile` are written but unbuilt.
  - The standalone bundle does include better-sqlite3's `linux-x64` prebuilt binary.
  - Running the standalone server directly on Windows fails on pnpm symlinks (EPERM). This is a
    Windows-only limitation; `pnpm start` works.
- **Real phone over HTTPS / PWA installation**: not exercised. The service worker registers only in
  secure contexts.
- **Manual UX review** of the "¿Cómo se calcula?" content, the charts and the pet art in a real
  browser. The pet art was rendered and inspected as a screenshot during development.
- **Scenario 12 with the network actually disconnected.**
