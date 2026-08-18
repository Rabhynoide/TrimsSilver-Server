# TrimsSilver-Server

Backend for TrimsSilver: authentication, data ingest and API for the [TrimsSilver-Client](https://github.com/Rabhynoide/TrimsSilver-Client) desktop app.

Stack: Next.js (TypeScript, App Router) + Prisma + PostgreSQL + Auth.js (Discord OAuth), self-hosted via Docker.

Built feature by feature — no placeholder/empty pages, only what's actually wired up.

## What's implemented so far

- Discord sign-in (Auth.js, database-backed sessions via Prisma/Postgres)
- Bearer-token API auth for the desktop client: `/cli-auth` (browser hand-off, mints a token) and `/api/tokens` (manual minting), validated via `/api/me`
- 7 private data ingest endpoints matching the client's uploads: market orders, player count, achievements, global multiplier, festivities, item estimated market values, private order shares
- [`/market-prices`](https://trimssilver.trimards-island.org/market-prices): a live Albion Online price checker (current + averaged prices and per-cell price history charts, all from the public AODP API, nothing stored server-side) with a category/tier/enchantment item browser and saved favorites for signed-in users

## Local development

Requirements: Node.js 22+, a local PostgreSQL (or use the `db` service from `docker-compose.yml`).

1. Copy `.env.example` to `.env` and fill in the values (see [Discord OAuth app](#discord-oauth-app) below).
2. Install dependencies: `npm install` (also generates the Prisma client).
3. Apply the database schema: `npm run db:migrate`.
4. Start the dev server: `npm run dev`, then open http://localhost:3000.

## Discord OAuth app

1. Create an application at https://discord.com/developers/applications.
2. Under **OAuth2 → General**, add a redirect URL: `{AUTH_URL}/api/auth/callback/discord`
   - Local dev: `http://localhost:3000/api/auth/callback/discord`
   - Production: `https://trimssilver.trimards-island.org/api/auth/callback/discord`
3. Copy the **Client ID** and **Client Secret** into `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` in `.env`.
4. Generate `AUTH_SECRET` with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

## Running with Docker

```bash
cp .env.example .env   # fill in real values first
docker compose up --build
```

This starts a `db` (Postgres) and `app` (Next.js, migrations applied automatically on boot) service. The app listens on port 3000 — put a reverse proxy (nginx/Caddy) with TLS in front of it for `https://trimssilver.trimards-island.org`.

## Database schema changes

Never edit `prisma/migrations/*` by hand. After changing `prisma/schema.prisma`, run `npm run db:migrate` to generate and apply a new migration.

## Market item catalog

`src/data/item-catalog.json` (used by `/market-prices`) is a static, committed snapshot of Albion's item data, not fetched at runtime. Regenerate it after a major game patch with:

```bash
npm run catalog:build
```

This pulls the latest data from [`ao-bin-dumps`](https://github.com/broderickhyman/ao-bin-dumps) and rewrites the file — review the diff and commit it like any other change.
