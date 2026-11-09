# Operations

## Environment

| Variable | Production | Development | Notes |
|---|---|---|---|
| `SESSION_SECRET` | required, ≥ 32 random chars | required | keys the stored session/device token hashes |
| `SETUP_TOKEN` | required, ≥ 32 random chars | optional | server-only; lets new profiles and devices be added after initial setup |
| `COOKIE_SECURE` | `true` (default) | `false` | `HttpOnly` and `SameSite=Strict` are always on |
| `DATABASE_PATH` | `/data/nutripet.db` | `./data/nutripet.db` | SQLite file (WAL mode) |
| `TCAC_ENABLED` | `false` | `false` | enable only after the ICBF license is verified |
| `OFF_USER_AGENT` | — | for `fetch:off` | identify the app; add a contact only if you want to share one |

Generate secrets with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
Never use a `NEXT_PUBLIC_` prefix for secrets.

## Deploy (Docker + Caddy)

```text
cp .env.example .env.production      # set SESSION_SECRET, SETUP_TOKEN, COOKIE_SECURE=true, DOMAIN
docker compose up -d --build         # app + Caddy (automatic HTTPS for $DOMAIN)
docker compose --profile tools run --rm tools pnpm fetch:usda
docker compose --profile tools run --rm tools pnpm import:foods --all
docker compose --profile tools run --rm tools pnpm import:coverage
```

The server applies migrations and seeds at startup (`src/instrumentation.ts`). The SQLite file lives
in `./data` on the host. HTTPS is required in production: Secure cookies and PWA installation depend
on it.

## Backups

- `pnpm backup:db` writes `data/backups/nutripet-YYYY-MM-DD.db` with `VACUUM INTO` (a consistent copy,
  safe while the app runs) and keeps the 14 most recent.
- Schedule it nightly, e.g. cron on the host:
  `15 3 * * * cd /srv/nutripet && docker compose --profile tools run --rm tools pnpm backup:db`.
- Copy `data/backups/` off the machine regularly.
- **Restore**:
  1. Stop the app (`docker compose stop app`).
  2. Copy the chosen backup over `data/nutripet.db` and delete `nutripet.db-wal` / `-shm`.
  3. Start the app again.

## Access management

- **Initial setup**: the first profile can be created without authentication. The device that does
  it is enrolled.
- **Add a profile**: from Perfil → "Agregar perfil" while signed in, or on any device with the
  `SETUP_TOKEN`.
- **Enroll a device**: Perfil → Dispositivos → "Generar código de emparejamiento" (single use,
  10 minutes), then enter it on the new device. Alternatively use the `SETUP_TOKEN`.
- **Revoke a device**: Perfil → Dispositivos → "Quitar". The device loses access to the selector
  immediately.
- **Rotate the setup token**: change `SETUP_TOKEN` in `.env.production` and
  `docker compose up -d app`. Enrolled devices and sessions are not affected.
- **Forgotten PIN**: the person uses their recovery code ("¿Olvidaste tu PIN?"). Without it, the
  operator runs `pnpm admin:reset-pin --profile "<nombre>"`, types a new PIN, and hands over the
  printed recovery code. This also resets the lockouts and ends that profile's sessions.
- **Lockouts**: 5 wrong PINs (or 5 wrong recovery codes, counted separately) lock for 60 s, then
  120 s, 240 s… up to 15 min. Setup-token and pairing-code attempts are limited per IP (5 failures →
  15 min).

## Catalog updates

See `docs/data-sources.md`. Re-imports are idempotent. Changed values become new food versions, and
logged entries keep the values they were logged with.
