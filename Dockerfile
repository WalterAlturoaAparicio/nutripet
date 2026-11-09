# syntax=docker/dockerfile:1
# NutriPet production image: Next.js standalone server + SQLite on a mounted volume.

FROM node:22-bookworm-slim AS deps
RUN npm install -g pnpm@12.4.2
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# A build-time placeholder only; the real secret is provided at runtime.
RUN SESSION_SECRET=build-time-placeholder-0123456789abcdef pnpm build

# "tools" target: full dependencies for one-off jobs (catalog import, coverage, demo seed, backups).
FROM build AS tools
ENV DATABASE_PATH=/data/nutripet.db
VOLUME /data

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production \
    COOKIE_SECURE=true \
    DATABASE_PATH=/data/nutripet.db \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
RUN useradd --system --uid 1001 nutripet && mkdir -p /data && chown nutripet /data
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/src/server/db/migrations ./src/server/db/migrations
USER nutripet
VOLUME /data
EXPOSE 3000
CMD ["node", "server.js"]
