# TrimsSilver — Project Status & Handoff

Written 2026-08-17 to resume development on another machine. Read this first in a new session — it's the durable record; a fresh Claude Code session on a different machine has no memory of this conversation.

## What TrimsSilver is

A fork of JPCodeCraft's "AFM Data Client" (`AlbionDataAvalonia`, an Albion Online market-data sniffer, originally for Albion Free Market) being turned into an independent product with its own backend and its own auth, no longer affiliated with AFM. The client fork keeps a required attribution link back to the original repo in its README (per the fork's LICENSE terms).

- **Client repo:** https://github.com/Rabhynoide/TrimsSilver-Client (branch `master`)
- **Server repo:** https://github.com/Rabhynoide/TrimsSilver-Server (branch `main`) — this repo
- **Backend URL:** https://trimssilver.trimards-island.org
- **Auth:** Discord OAuth (via Auth.js), not the old Google/Firebase flow AFM used
- Local clones live side by side on the original dev machine under `...\GitHub\Albion\TrimsSilver-Client` and `...\GitHub\Albion\TrimsSilver-Server`.

## Stack

- **Server (this repo):** Next.js 16 (TypeScript, App Router, Tailwind) + Prisma 7 + PostgreSQL + Auth.js v5 (Discord provider, database sessions via `@auth/prisma-adapter`). Prisma 7 requires an explicit driver adapter (`@prisma/adapter-pg` + `pg`) — see `src/lib/prisma.ts`; there's no more implicit native engine like Prisma 5/6. Dockerized (`Dockerfile` + `docker-compose.yml`, app + Postgres, migrations run automatically on container boot).
- **Client:** unchanged .NET/Avalonia desktop app — see `TrimsSilver-Client/AGENTS.md` for its own build instructions.

## Status as of 2026-08-17

### Done
- Server scaffolded; Discord sign-in works end-to-end (user tested it live in a browser).
- Client fully rebranded from AFM to TrimsSilver at the code level: class/identifier renames (`AFMUploader`→`TrimsSilverUploader`, `Afm*` settings fields→`TrimsSilver*`, etc.), app identity (AppData folder, Inno Setup installer, macOS bundle id `org.trimardsisland.trimssilver`, Linux install scripts, self-update URLs now point at this GitHub org). Commit `630d31a` on `TrimsSilver-Client`, build verified with 0 errors. Client issue #1 closed.
- Removed the client's old behavior of downloading `AppSettings` from AFM's CDN at runtime (`SettingsManager.cs`) — it would have silently broken with the renamed settings fields, and no longer made sense for an independent fork anyway.

### Deliberately not done yet (by design, not forgotten)
- Client UI text/log strings that still literally describe the **live** AFM backend (legendary item marketplace, "sign in to AFM" prompts, EMV/achievements upload messages) — relabeling those to "TrimsSilver" before the backend actually exists would be misleading, since the client still genuinely uploads there today. Fix once the client points at the new backend (see Next steps).
- README screenshots/full content pass and new icon/logo artwork — design work, not code, out of scope for the rebrand pass.

### Key architecture decision (2026-08-17)
The client's **public AODP channel stays exactly as-is** — `MarketOrder`, `GoldPriceUpload`, `MarketHistoriesUpload`, `BanditEventUpload` keep uploading straight to `pow.*.albion-online-data.com` like today. No client changes needed for this, and TrimsSilver-Server does **not** need to ingest/store this data. Instead, TrimsSilver-Server will act as a **reader** of AODP's public REST API (`https://<region>.albion-online-data.com/api/v2/stats/...`, no auth needed) to fetch current/historical prices — both what we contribute and what everyone else contributes.

This means only the **private, Discord-authenticated channel** needs a database schema and ingest endpoints on our side. From the client's upload models (`AlbionDataAvalonia/Network/Models/`), that's 7 payload shapes, none of which have a Prisma model yet (current `prisma/schema.prisma` only has the Auth.js tables — `User`, `Account`, `Session`, `VerificationToken`):

| Client type | Fields | Old AFM endpoint |
|---|---|---|
| `TrimsSilverMarketUpload` | Orders (item/location/quality/enchant/price/amount/auctionType/expires) + ServerId + UploaderId | `flipperOrders` |
| `PlayerCount` | Location, Server, DateTime, NonFlaggedCount, FlaggedCount, IsBz | `playercount` |
| `AchievementUpload` | CharacterName, ServerId, Achievements[{Id, Level}] | `be/achievements` |
| `GlobalMultiplierUpload` | ServerId, GlobalMultiplier | `be/globalMultiplier` |
| `FestivitiesUpload` | ServerId, Events[{Kind, Category, UniqueName, StartTime, EndTime}] | `be/festivities` |
| `ItemEstimatedMarketValueUpload` | ServerId, Items[{ItemUniqueName, Emv, BlackMarketEmv, Quality, Day}] | `itemEstimatedMarketValues` |
| `PrivateOrderShares` | SharedUsers[{Value, Type, Resolved}] (GET/PUT, not a queued upload) | `privateOrderShares` |

**Not yet designed or implemented.** This is the next concrete task (see below).

## GitHub issues (source of truth for granular tracking)

Server (`Rabhynoide/TrimsSilver-Server`):
- #1 — Endpoint d'ingestion des données de marché — **needs a scope-revision comment**: only the 7 private types above, not public AODP data (see architecture decision).
- #2 — Dashboard utilisateur
- #3 — Optimiser l'image Docker (currently ships full `node_modules` incl. dev deps for reliability; revisit once there's more to containerize)

Client (`Rabhynoide/TrimsSilver-Client`):
- #1 — Rebranding AFM → TrimsSilver — **closed**, done
- #2 — Pointer le client vers TrimsSilver-Server — **scope reduced**: only the private channel (`TrimsSilverIngestApiBase` and its sub-paths), not the public AODP uploader
- #3 — Remplacer l'auth Google/Firebase par Discord OAuth dans `AuthService.cs`
- #4 — Reset du versioning client à 0.x

## Environment gotchas hit on the original dev machine

- **NuGet.Config**: the machine's global `%APPDATA%\NuGet\NuGet.Config` had an *empty* `<packageSources>` list, causing `dotnet restore` to fail with `NU1100` on every single package (even base .NET runtime packs). Not a code issue. Fix: `dotnet nuget add source https://api.nuget.org/v3/index.json -n nuget.org`. Check this first on a new machine if `dotnet restore`/`dotnet build` on `TrimsSilver-Client` fails everywhere at once.
- **Local Postgres without Docker**: `npx prisma dev --detach` (inside `TrimsSilver-Server`) starts a zero-install local Postgres-compatible instance and prints a connection string — put that in `.env`'s `DATABASE_URL`, then `npx prisma db push` (or `npm run db:migrate` if there's a real dev DB reachable for the shadow-database diffing `migrate dev` needs).
- **`.env` is gitignored** (correctly) — a new machine needs its own copy from `.env.example`, with a real Discord OAuth app's `AUTH_DISCORD_ID`/`AUTH_DISCORD_SECRET` (create one at https://discord.com/developers/applications if starting fresh, redirect URI `{AUTH_URL}/api/auth/callback/discord`) and a generated `AUTH_SECRET` (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).
- **`gh` CLI** wasn't installed originally; needed for issue tracking (`winget install GitHub.cli`, then `gh auth login` interactively in a real terminal — Claude Code can't do the browser login step for you).

## Next steps, in the order they were being tackled

1. Design the Prisma schema for the 7 private upload types above (each linked to `User` via the Discord-authenticated account) and implement the ingest endpoints.
2. Client issue #3: Discord OAuth flow in `AuthService.cs` — mirrors the existing Google/Firebase pattern (open system browser, `HttpListener` on localhost catches the redirect) but against TrimsSilver-Server's Discord flow instead.
3. Client issue #2 (reduced scope): point the private-channel settings (`TrimsSilverAuthClientId`, `TrimsSilverIngestApiBase`, etc. in `DefaultAppSettings.json`) at the real TrimsSilver-Server deployment.
4. Later, lower priority: an AODP public-data reader/cache service on the server (per the architecture decision above) — not blocking anything else.
