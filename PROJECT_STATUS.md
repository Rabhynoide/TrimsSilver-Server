# TrimsSilver — Project Status & Handoff

Written 2026-08-17, updated same day after implementing the ingest endpoints, then the Discord OAuth client flow, then confirming the whole thing works live in production. Updated again 2026-08-18 after building and shipping the Market Prices page. Read this first in a new session — it's the durable record; a fresh Claude Code session on a different machine has no memory of this conversation.

## What TrimsSilver is

A fork of JPCodeCraft's "AFM Data Client" (`AlbionDataAvalonia`, an Albion Online market-data sniffer, originally for Albion Free Market) being turned into an independent product with its own backend and its own auth, no longer affiliated with AFM. The client fork keeps a required attribution link back to the original repo in its README (per the fork's LICENSE terms).

- **Client repo:** https://github.com/Rabhynoide/TrimsSilver-Client (branch `master`)
- **Server repo:** https://github.com/Rabhynoide/TrimsSilver-Server (branch `main`) — this repo
- **Backend URL:** https://trimssilver.trimards-island.org — **live**, deployed as a Docker Compose stack via Portainer on the user's own server. Verified reachable with the Discord sign-in button rendering.
- **Auth:** Discord OAuth (via Auth.js), not the old Google/Firebase flow AFM used
- Local clones live side by side on the original dev machine under `...\GitHub\Albion\TrimsSilver-Client` and `...\GitHub\Albion\TrimsSilver-Server`.

## Stack

- **Server (this repo):** Next.js 16 (TypeScript, App Router, Tailwind) + Prisma 7 + PostgreSQL + Auth.js v5 (Discord provider, database sessions via `@auth/prisma-adapter`). Prisma 7 requires an explicit driver adapter (`@prisma/adapter-pg` + `pg`) — see `src/lib/prisma.ts`; there's no more implicit native engine like Prisma 5/6. Dockerized (`Dockerfile` + `docker-compose.yml`, app + Postgres, migrations run automatically on container boot).
- **Client:** unchanged .NET/Avalonia desktop app — see `TrimsSilver-Client/AGENTS.md` for its own build instructions.

## Status as of 2026-08-17 (end of day)

### Done
- Server scaffolded; Discord sign-in works end-to-end (user tested it live in a browser).
- Client fully rebranded from AFM to TrimsSilver at the code level: class/identifier renames (`AFMUploader`→`TrimsSilverUploader`, `Afm*` settings fields→`TrimsSilver*`, etc.), app identity (AppData folder, Inno Setup installer, macOS bundle id `org.trimardsisland.trimssilver`, Linux install scripts, self-update URLs now point at this GitHub org). Commit `630d31a` on `TrimsSilver-Client`, build verified with 0 errors. Client issue #1 closed.
- Removed the client's old behavior of downloading `AppSettings` from AFM's CDN at runtime (`SettingsManager.cs`) — it would have silently broken with the renamed settings fields, and no longer made sense for an independent fork anyway.
- **Server deployed live** via Docker/Portainer stack on the user's own server (see Deployment section below for the fixes this took).
- **Prisma schema + ingest endpoints for all 7 private upload types implemented, tested end-to-end against a local dev DB, and deployed** (issue #1 scope). See "Private data model" below.
- **Client issue #3 done: `AuthService.cs` now does Discord OAuth against TrimsSilver-Server instead of Google/Firebase.** Client build verified with 0 new errors/warnings.
- **Client issue #2 done: `TrimsSilverIngestApiBase` points at the live server.**
- **✅ Full end-to-end chain confirmed working live in production**, with a real Discord account and the real game running — not just curl tests. See "Confirmed working end-to-end" below.

### Deployment (Docker/Portainer) — fixes applied this session
Two things broke the first Portainer stack deploy, both now fixed and committed:
1. **`env_file: - .env` doesn't work with Portainer.** Portainer's stack "Environment variables" UI doesn't necessarily materialize a `.env` file next to `docker-compose.yml` on the host, so `env_file: - .env` failed with `.env not found`. Fixed by switching `docker-compose.yml`'s `app` service to `environment: { AUTH_SECRET: ${AUTH_SECRET:?...}, ... }`-style interpolation instead — Portainer's env var UI feeds `${VAR}` substitution directly, file or not. **You must set `AUTH_SECRET`, `AUTH_URL` (the real public URL, not localhost), `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET` in Portainer's stack env var UI** — `DATABASE_URL` is hardcoded in the compose file and doesn't need to be set there.
2. **`Dockerfile` copied a `public/` folder that didn't exist** (Next.js App Router doesn't need one — favicon lives in `src/app/`), so the Docker build failed on `COPY --from=builder /app/public ./public`. Fixed by adding `public/.gitkeep` so the folder is tracked in git and exists in the build context.

### Private data model (issue #1)
`prisma/schema.prisma` now has, beyond the Auth.js tables: `MarketOrder`, `PlayerCount`, `AchievementSnapshot`+`AchievementEntry`, `GlobalMultiplier`, `FestivitySnapshot`+`FestivityEvent`, `ItemEstimatedMarketValue`, `PrivateOrderShare`, plus an `ApiToken` model for API auth (see below). Migration `20260817120000_add_private_ingest_models` adds them; `Dockerfile`'s `npx prisma migrate deploy` on container boot applies it automatically on next Portainer redeploy — no manual DB step needed.

Design notes worth knowing before extending this:
- Every private row is linked to the authenticated uploader via a relation to `User` — **client-supplied ids in the payload (e.g. `uploaderId`) are always ignored**, the uploader is resolved server-side from the bearer token.
- `MarketOrder` and `ItemEstimatedMarketValue` are upsert-as-current-state tables (unique on `(serverId, orderId)` / `(serverId, itemUniqueName, quality, day)`), not append logs.
- `AchievementSnapshot`/`FestivitySnapshot` replace their child rows wholesale on every upload (delete + recreate in a transaction) rather than diffing.
- `PlayerCount` is the only true append-only time series.
- `PrivateOrderShare`: **identifier resolution isn't implemented** — every submitted value is stored and returned as `resolved: false, type: "unresolved"`. No design exists yet for matching a shared identifier (e.g. a Discord tag) to a real TrimsSilver account; that's a real gap, not an oversight to silently work around.
- `serverId` is a plain `Int` (1=Americas, 2=Asia, 3=Europe, hardcoded client-side in `AlbionServers.cs`) — no reference table needed.

### API auth: bearer tokens, not the Auth.js session cookie
The desktop client has no cookie jar, so it can't use Auth.js's database session cookie directly. Added:
- `ApiToken` Prisma model (hashed token storage, never the raw value; no expiry — tokens are long-lived personal-access-token style, revoked by deleting the row, not rotated).
- `src/lib/api-auth.ts`: `mintApiToken(userId, label)` (shared minting helper) and `requireApiUser(request)` (validates `Authorization: Bearer <token>` on every ingest route).
- `POST /api/tokens` — mints a token for the currently signed-in browser session directly (for manual use / a future dashboard). `GET /api/tokens` lists a user's tokens (metadata only).
- **`GET /cli-auth?redirect_uri=<loopback-url>`** — what the desktop client actually opens in the system browser. Signs the user into Discord if needed (via a click-through button — `next-auth`'s `signIn()` mutates cookies, which Next.js only allows inside a Server Action, not a bare page render, so it can't happen automatically on page load), then a second click-through ("Autoriser") mints a token via a Server Action and redirects to `redirect_uri` with `?token=...` attached. **`redirect_uri` is validated server-side to be `http://localhost`, `http://127.0.0.1`, or `http://[::1]`, rejecting everything else** — this hands out a live credential, so allowing arbitrary redirect targets would be an open-redirect-to-credential-leak vulnerability.
- **`GET /api/me`** — validates a bearer token and returns `{id, name, email, image}`, or 401. Since `ApiToken` never expires, this fully replaces the old Firebase refresh-token exchange: a token is either still accepted or it isn't, nothing to refresh.

This is no longer a stopgap — it's the actual, complete, tested flow. Only gap: no UI to revoke/list a lost device's token yet (would need a dashboard page calling `GET/DELETE` on `ApiToken` rows — not built).

### Client auth flow (`AuthService.cs`, client issue #3)
`SignInAsync()` now: opens the browser to `{TrimsSilverAuthUrl}?redirect_uri={TrimsSilverAuthRedirectUri}` (a local `HttpListener`, same pattern as before) → user signs into Discord + clicks "Autoriser" on `/cli-auth` → listener catches `?token=...` → client calls `GET {TrimsSilverIngestApiBase}/me` with that bearer token to fetch profile info → stores the token in the existing local SQLite `UserAuth` table (repurposed: the `RefreshToken` column now holds the non-expiring TrimsSilver token, not a Firebase refresh token — no EF migration needed, same column).

Because tokens don't expire, the whole refresh-scheduling machinery is gone: `EnsureValidTokenAsync()` is now a synchronous local presence check (no network call, safe to call before every upload), and `TryRecoverFromUnauthorizedAsync()`/`ForceTokenRefreshAsync()` both just re-validate against `GET /api/me` — log the user out only on a confirmed 401, leave the session alone on a transient network error.

`FirebaseAuthResponse` (the model) **keeps its name and shape** on purpose — every consumer (`MainViewModel`, `SettingsViewModel`, `LegendaryViewModel`, `PortfolioUploadService`, `LegendarySaleService`, `ItemEstimatedMarketValueBackendLoader`, `TrimsSilverUploader`) binds to `CurrentFirebaseUser`/`FirebaseUserChanged`/`FirebaseUserId`/`.IdToken`/`.LocalId` and none of that changed, so **none of those 8 files needed touching**. Renaming `FirebaseAuthResponse` itself is deferred alongside the other leftover AFM/Firebase-branded UI strings already noted below.

Settings changes in `AppSettings.cs`/`DefaultAppSettings.json`: `TrimsSilverAuthClientId` (Discord client id) is **gone** — the client never talks to Discord directly anymore, only to our own server. `TrimsSilverAuthApiUrl` is replaced by `TrimsSilverAuthUrl`, already set to the live `https://trimssilver.trimards-island.org/cli-auth`. `TrimsSilverAuthRedirectUri` is unchanged (`http://localhost:5000/`). `TrimsSilverIngestApiBase` is now `https://trimssilver.trimards-island.org/api/` — **trailing slash is load-bearing**, not cosmetic: `TrimsSilverUploader.cs` combines it with relative paths via `new Uri(base, relative)`, and without the trailing slash `Uri` (like any RFC 3986 resolver) drops the base's last path segment, silently sending every request to the domain root instead of `/api/...`. Caught and fixed in commit `eadc1ee` before it shipped.

### Confirmed working end-to-end (2026-08-17, live production)
Ran the client from source (`dotnet run --project AlbionDataAvalonia.Desktop`) to show how to test it, and the user signed in for real with their own Discord account while playing Albion Online. Server logs and client logs both confirm the full chain worked, live, against production — not a curl simulation:

```
21:51:00 Browser opened for Discord sign-in.
21:51:02 Received token from the auth redirect.
21:51:02 User signed in: re***************fr
21:51:27 Successfully sent 48 item estimated market values to AFM EMV endpoint.
21:51:37 Successfully sent global multiplier 1.156 for server 3 to AFM global multiplier endpoint.
21:51:38 Successfully sent 457 achievements for character Rabhynoide on server 3 to AFM achievements endpoint.
```

That's `/cli-auth` (Discord sign-in + consent + token mint) and three different ingest routes (`itemEstimatedMarketValues`, `be/globalMultiplier`, `be/achievements`) all round-tripping real data into production Postgres, driven entirely by the app's normal live-gameplay upload paths — no manual testing scaffolding involved. `flipperOrders`, `playercount`, `be/festivities`, and `privateOrderShares` weren't separately confirmed live this way (no matching gameplay event happened during the session) but share the same auth path and were already curl-verified against a local dev DB.

### Ingest endpoints (exact same relative paths as the old AFM ones on purpose)
So that client issue #2 only needs a settings change (`TrimsSilverIngestApiBase` → `https://trimssilver.trimards-island.org/api`), not a client code change:

| Route | Method | Old AFM path |
|---|---|---|
| `/api/flipperOrders` | POST | `flipperOrders` |
| `/api/playercount` | POST | `playercount` |
| `/api/be/achievements` | POST | `be/achievements` |
| `/api/be/globalMultiplier` | POST | `be/globalMultiplier` |
| `/api/be/festivities` | POST | `be/festivities` |
| `/api/itemEstimatedMarketValues` | POST | `itemEstimatedMarketValues` |
| `/api/privateOrderShares` | GET, PUT | `privateOrderShares` |

All tested end-to-end against a local dev DB with curl (auth rejection, successful writes, and upsert idempotency all verified working).

### Deliberately not done yet (by design, not forgotten)
- README screenshots/full content pass and new icon/logo artwork — design work, not code, out of scope for the rebrand pass.

### Client UI/log text rebranded — and a real bug found along the way (2026-08-18)
Went through every remaining "AFM" string in the client (`TrimsSilverUploader.cs` and everything it feeds, the app's own self-name in log lines and Settings/Dashboard text, the backup/restore instructions) and renamed the ones that now genuinely target TrimsSilver-Server. Deliberately left "AFM" wording alone in Portfolio, the Legendary item marketplace, and `OpenAFMWebsite()`/the AFM Discord link — those still call the real `api.albionfreemarket.com`, so the text was accurate, not stale. Commit `bc07800` on `TrimsSilver-Client`.

Found and fixed a real correctness bug while at it, unrelated to branding: the backup-restore instructions (`SettingsView.axaml`, `README.md`) referenced a database filename of `afmdataclient.db`, but `AppData.cs` has written `trimssilver.db` since the original rebrand — anyone following those steps literally would look for a file that no longer exists.

**Bigger finding**: verifying which backend each "AFM" string actually pointed at surfaced a real regression from the auth rewrite. `PortfolioUploadService`, `LegendarySaleService`, and `ItemEstimatedMarketValueBackendLoader` all send `authService.CurrentFirebaseUser.IdToken` as a Bearer token to the *real* AFM backend (`TrimsSilverBackendApiBase`/`TrimsSilverTopItemsApiBase`, still `api.albionfreemarket.com`). Since the Discord/TrimsSilver auth rewrite, that token is a TrimsSilver-only opaque token AFM has never issued and can't validate — those three features would 401 on every real request. **User decision: disable them for now** rather than leave them silently broken. Commit `fbd86a3` adds a single `FeatureFlags.AfmIntegrationEnabled = false` switch (in `AlbionDataAvalonia/Settings/FeatureFlags.cs`) that:
- Short-circuits Portfolio uploads before any network call (updated the "sign in to AFM" messaging, since being signed in wouldn't help anymore).
- Disables the Legendary view's "List for sale"/"Update price"/"Relist" actions with a clear status message — the item **tracking** table itself (locally captured, not AFM-dependent) is untouched and still fully functional.
- Disables the "Add to Portfolio" buttons in Trades/Gathering directly instead of letting them fail after a click.
- Stops `ItemEstimatedMarketValueBackendLoader` from queuing AFM lookups at all.

**Still undecided, needs a real product decision, not a code fix**: whether to (a) leave these retired permanently as AFM-branded premium features that don't fit an independent TrimsSilver, (b) reintroduce a second, parallel Google/Firebase auth flow just for these three features alongside the new Discord flow, or (c) something else. Flip `FeatureFlags.AfmIntegrationEnabled` back to `true` only once whichever auth path they'll actually use again is real.

### Key architecture decision (2026-08-17)
The client's **public AODP channel stays exactly as-is** — `MarketOrder`, `GoldPriceUpload`, `MarketHistoriesUpload`, `BanditEventUpload` keep uploading straight to `pow.*.albion-online-data.com` like today. No client changes needed for this, and TrimsSilver-Server does **not** need to ingest/store this data. Instead, TrimsSilver-Server will act as a **reader** of AODP's public REST API (`https://<region>.albion-online-data.com/api/v2/stats/...`, no auth needed) to fetch current/historical prices — both what we contribute and what everyone else contributes. This reader/cache service is not built yet (see Next steps).

## GitHub issues (source of truth for granular tracking)

Server (`Rabhynoide/TrimsSilver-Server`):
- #1 — Endpoint d'ingestion des données de marché — **closed**. Scope-revision comment posted (7 private types only, not public AODP data).
- #2 — Dashboard utilisateur — open. Comment posted noting its prerequisites (Discord auth, market ingestion) are done.
- #3 — Optimiser l'image Docker — open, unchanged (currently ships full `node_modules` incl. dev deps for reliability; revisit once there's more to containerize).
- #4 — Résolution d'identifiants pour `PrivateOrderShares` — new, open. Split out of the "Private data model" gap noted above.
- #5 — Page de gestion des tokens API (lister/révoquer) — new, open. Concrete first slice of #2, split out into its own issue since it's independently actionable.
- #6 — Service de lecture des données publiques AODP — open, narrowed. Comment posted: the live-proxy read is done (Market Prices' `GET /api/market/prices`), what's left is server-side caching/storage, not just reading.
- #7 — Market Prices : vue détaillée d'un item + historique de prix (graphique) — new, open. The one deliberately deferred piece of the Market Prices v1 scope; low priority.

Client (`Rabhynoide/TrimsSilver-Client`):
- #1 — Rebranding AFM → TrimsSilver — **closed**, done
- #2 — Pointer le client vers TrimsSilver-Server — **closed**. Comment posted covering the trailing-slash `Uri` gotcha and the PoW question (not kept — Discord auth replaces it for the private channel; public AODP's PoW is untouched).
- #3 — Remplacer l'auth Google/Firebase par Discord OAuth dans `AuthService.cs` — **closed**. Comment posted covering the new flow and the `ItemEstimatedMarketValueBackendLoader`/Portfolio/Legendary auth breakage.
- #4 — Reset du versioning client à 0.x — open. Comment posted noting its prerequisite (rebranding, #1) is done.
- #5 — Portfolio, marketplace Legendary et lookups EMV AFM cassés (401) — new, open. Full writeup of the "Client UI/log text rebranded" finding above; this is where the actual product decision should get tracked/discussed, not just here.

All issues (server #1-7, client #1-5) reflect this doc as of 2026-08-18 — GitHub is the source of truth for granular tracking, this doc for the "why" behind each.

## Environment gotchas hit on the original dev machine

- **NuGet.Config**: the machine's global `%APPDATA%\NuGet\NuGet.Config` had an *empty* `<packageSources>` list, causing `dotnet restore` to fail with `NU1100` on every single package (even base .NET runtime packs). Not a code issue. Fix: `dotnet nuget add source https://api.nuget.org/v3/index.json -n nuget.org`. Check this first on a new machine if `dotnet restore`/`dotnet build` on `TrimsSilver-Client` fails everywhere at once.
- **Local Postgres without Docker**: `npx prisma dev --detach` (inside `TrimsSilver-Server`) starts a zero-install local Postgres-compatible instance and prints a connection string — put that in `.env`'s `DATABASE_URL`.
- **`prisma migrate dev` fights with `prisma dev`'s auto-sync.** The local `prisma dev` server auto-applies whatever's in `prisma/migrations/` to both the main *and* shadow database on every start/reconnect, but without populating `_prisma_migrations` history — so `migrate dev` reliably fails with **P3005** ("schema not empty") or **P3006/P3018** ("relation already exists" on the shadow DB) even against a supposedly fresh instance. What actually worked: `npx prisma migrate resolve --applied <last-migration-name>` to baseline the history table against the already-applied schema, then generate the new migration's SQL directly with `npx prisma migrate diff --from-config-datasource --to-schema ./prisma/schema.prisma --script > prisma/migrations/<name>/migration.sql` (bypasses the shadow DB entirely), apply it with `npx prisma db execute --file <that file>`, then `npx prisma migrate resolve --applied <name>` again to record it. `prisma migrate reset --force` requires explicit user consent — Prisma itself blocks AI agents from running it unattended.
- **`.env` is gitignored** (correctly) — a new machine needs its own copy from `.env.example`, with a real Discord OAuth app's `AUTH_DISCORD_ID`/`AUTH_DISCORD_SECRET` (create one at https://discord.com/developers/applications if starting fresh, redirect URI `{AUTH_URL}/api/auth/callback/discord`) and a generated `AUTH_SECRET` (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).
- **`gh` CLI** wasn't installed originally; needed for issue tracking (`winget install GitHub.cli`, then `gh auth login` interactively in a real terminal — Claude Code can't do the browser login step for you).
- **Portainer stack env vars**: see "Deployment" above — use Portainer's stack env var UI, not a `.env` file, for `AUTH_SECRET`/`AUTH_URL`/`AUTH_DISCORD_ID`/`AUTH_DISCORD_SECRET`.

## How to test the client/server link

Two levels: a fast server-only check (no client build, no Discord account needed beyond a browser sign-in), then the real end-to-end client test.

### 1. Prerequisite: redeploy the Portainer stack
`/cli-auth`, `/api/me`, and the 7 ingest routes are pushed to `main` but **won't exist on the live server until the Portainer stack is redeployed/rebuilt** from the latest commit. Do this first, or every step below will 404.

### 2. Server-only check (fastest, proves the whole server side works)
1. Open `https://trimssilver.trimards-island.org` in a browser, sign in with Discord.
2. Open browser dev tools → Console, run:
   ```js
   const r = await fetch("/api/tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
   console.log(await r.json()); // note the "token" value
   ```
3. In a terminal, validate it and try an ingest call:
   ```bash
   curl https://trimssilver.trimards-island.org/api/me -H "Authorization: Bearer <token>"
   curl -X POST https://trimssilver.trimards-island.org/api/be/globalMultiplier \
     -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
     -d '{"serverId":1,"globalMultiplier":1.1}'
   ```
   Both should return `200`/`{"ok":true}`. This alone confirms Discord sign-in, token minting, and the ingest pipeline all work in production — without touching the desktop client.

### 3. Real end-to-end test with the desktop client
1. Build & run `TrimsSilver-Client` (`AlbionDataAvalonia.Desktop` or the platform-specific startup project — see `TrimsSilver-Client/AGENTS.md`). It now ships with `TrimsSilverAuthUrl`/`TrimsSilverIngestApiBase` already pointed at the live server (see commits `dcbc19c`, `eadc1ee`).
2. In the running app, go to the main view's **Authentication** section and click **Sign In**.
3. This opens your system browser to `https://trimssilver.trimards-island.org/cli-auth?redirect_uri=http://localhost:5000/`. Sign in with Discord, then click **Autoriser**.
4. The browser tab should show "TrimsSilver sign-in successful. You can close this window." — if instead you get a connection error on `localhost:5000`, the client's `HttpListener` isn't running/reachable (check the client is actually running and nothing else holds port 5000).
5. Back in the client, the Authentication section should switch to the logged-in state (avatar/initials, upload options visible). Client logs (Serilog) should show `User signed in: ...`.
6. To confirm data actually reaches the server: either open the game with the client capturing traffic and watch for successful upload log lines, or just re-run the `curl .../api/me` check from step 2 with the token the client now has stored locally (SQLite `UserAuth` table, `RefreshToken` column) — same validation, proves the client's stored token is accepted.

## Market Prices page (2026-08-18) — done, confirmed working live

Added a public-facing `/market-prices` page — the site's first real data-browsing UI (previously just `/` and `/cli-auth`). Modeled loosely on AFM's own Price Checker (screenshots the user supplied), but deliberately **not** a clone: no Intro/marketing tab, no Shareable URLs, no Preconfigured Links (all explicitly declined, not deferred — the screenshots were reference material, not a spec to replicate 1:1), and no per-item historical chart yet (AFM's "Chart Days" control) — the chart is the one piece genuinely deferred, tracked as server issue #7.

- **Item catalog**: `scripts/build-item-catalog.mjs` (`npm run catalog:build`) fetches `items.json` + `formatted/items.json` from `broderickhyman/ao-bin-dumps` and extracts one row per tradable item (has a `shopcategory` and a resolvable EN-US name, and isn't flagged `@showinmarketplace=false`/`@hidefromplayer=true` — excludes vanity skins, GvG trophies, quest items) into the committed `src/data/item-catalog.json` — **3,493 items**, ~415 KB. Not wired into CI; rerun manually after major game patches. Served via `GET /api/market/items` (module-scope in-memory cache, not a DB table).
  - Each item carries `enchantSuffix` (`"@"` or `"_LEVEL"`) and `hasQuality` (bool), both **discovered from the actual game data**, not guessed:
    - **Enchant addressing differs by item type.** Equipment enchant variants are a nested `enchantments.enchantment` array on the base item and AODP addresses them as `UNIQUENAME@N`. Resources (raw ore/wood/fiber/hide/rock and refined metal bar/planks/leather/cloth) are different: each enchant level is its **own standalone game item** named `UNIQUENAME_LEVELN` with no localization string of its own — and AODP's actual addressing for those is `UNIQUENAME_LEVELN@N`, both markers combined, confirmed against a working AODP URL the user found. `itemId()` in `types.ts` builds the right one per item.
    - **Quality (Normal..Masterpiece) only applies to equipment/mounts** — resources, farmables, consumables etc. are always quality 1. Driven by `@maxqualitylevel`, present only on `equipmentitem`/`weapon`/`mount` raw-data entries. `PriceGrid.tsx` renders a single "Price" column instead of 5 when `hasQuality` is false.
- **Shop Categories picker** (`CategoryTree.tsx` + `categoryTaxonomy.ts`): a 3-column drill-down (category → subcategory → type), not a flat checkbox list. Raw `shopcategory`/`shopsubcategory1` values are grouped into a friendlier taxonomy (Weapons, Chest/Head/Foot Armor, Off-Hands, Capes, Bags, Mounts, Consumables, Vanity, Gathering Equipment, Artifacts, Farming, Furniture, Materials & Resources, Skillbooks, Trophies, Labourer Contracts, Other). The last level collapses tier-only variation into one row per real "type": gear names follow `{tier rank}'s {line name}` (e.g. "Adept's Broadsword" T4 / "Elder's Broadsword" T8) so stripping the rank prefix groups tiers of the same line together; non-gear items (Ore, Wood, ...) don't have that prefix but get the same treatment when a subcategory's items each sit at a distinct tier (a genuine 1:1 tier progression) — subcategories with many *different* items sharing a tier (e.g. ~90 distinct Furniture decorations mostly at T1) are correctly left ungrouped.
- **Live prices**: `src/lib/aodp.ts` proxies AODP's public stats API (no auth) — `fetchCurrentPrices()` hits `/stats/prices/...`, `fetchAveragePrices()` hits `/stats/history/...` and averages `avg_price`/`item_count` buckets over the requested day window server-side (→ avg price *and* avg amount traded). Region subdomains (`west`/`east`/`europe`) match the client's `AlbionServers.cs` `serverId` convention. `GET /api/market/prices` merges both into one response, capped at 100 items per request, nothing persisted. **This is the live-proxy slice of issue #6** ("AODP reader service") — the fuller caching/storage half of that issue is still open and unbuilt.
- **Favorites**: `MarketPriceFavorite` Prisma model (migration `20260818090000_add_market_price_favorite`), gated on the Auth.js session cookie (`GET/POST /api/market/favorites`, `PATCH/DELETE /api/market/favorites/[id]`) — browser-only, unrelated to the desktop client's bearer-token ingest auth. Price Checker itself stays open to anonymous visitors, matching AFM; only saving/loading favorites requires Discord sign-in.
- **Price cell**: headline sell/buy price centered, average price bottom-left, average amount traded bottom-right, an hours-old freshness badge top-right (color-coded). Prices load automatically the first time an item is selected (so the grid isn't just dashes until someone notices the button); every change after that is manual via **Refresh Prices**.
- UI lives under `src/app/market-prices/` (`MarketPricesApp.tsx`, `ItemPicker.tsx`, `CategoryTree.tsx`, `PriceGrid.tsx`, `FavoritesTab.tsx`, `categoryTaxonomy.ts`, `types.ts`, `actions.ts`), dark Tailwind theme matching the rest of the site rather than AFM's palette.
- **Confirmed working live in production** by the user after redeploy — category tree, item selection, and populated price grids (including enchanted resources) all verified against real data, not just curl.

## Next steps, in the order they were being tackled

1. **Decide the fate of Portfolio / Legendary marketplace / AFM EMV lookups** — client issue #5, currently disabled via `FeatureFlags.AfmIntegrationEnabled = false`. This is a product decision (retire vs. reintroduce a second Google/Firebase auth flow vs. something else), not something to solve with more code without direction.
2. `PrivateOrderShares` identifier resolution — server issue #4.
3. A dashboard page to list/revoke `ApiToken`s — server issue #5.
4. `flipperOrders`, `playercount`, and `be/festivities` haven't been seen working live yet (just not exercised by gameplay during the test session) — worth a quick real-world confirmation next time the client runs, though there's no reason to expect them to behave differently from the three routes already confirmed. Not filed as its own issue — a verification task, not a bug or a feature.
5. Market Prices per-item detail view + historical price chart — server issue #7, low priority, explicitly deferred v1 scope.
6. Later, lower priority: an AODP public-data reader/cache service **with actual caching/storage** on the server — server issue #6 narrows to just that now that the live-proxy half is done.
