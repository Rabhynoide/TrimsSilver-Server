# TrimsSilver-Server

Backend for TrimsSilver: authentication, data ingest and API for the [TrimsSilver-Client](https://github.com/Rabhynoide/TrimsSilver-Client) desktop app.

Stack: Next.js (TypeScript, App Router) + Prisma + PostgreSQL + Auth.js (Discord OAuth), self-hosted via Docker.

Built feature by feature — no placeholder/empty pages, only what's actually wired up.

## What's implemented so far

- Discord sign-in (Auth.js, database-backed sessions via Prisma/Postgres)

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
