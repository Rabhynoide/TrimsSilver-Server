import farmingCatalog from "@/data/farming-catalog.json";
import journalCatalog from "@/data/journal-catalog.json";
import craftingCatalog from "@/data/crafting-catalog.json";
import foodCatalog from "@/data/food-catalog.json";
import resourceCatalog from "@/data/resource-catalog.json";
import { journalMarketId, resourceMarketId } from "@/data/journal-constants";
import { CRAFT_FINDER_CACHED_ENCHANT } from "@/data/craft-finder-constants";
import { craftItemId } from "@/app/crafting/calc";
import { AODP_REGIONS, fetchCurrentPrices, type AodpRegion, type AodpPriceRow } from "./aodp";
import { prisma } from "./prisma";

// Every tradable location — Farming/Journals both let the user pick any of
// these as buy/sell city, so the cache has to cover all of them, not just
// the currently-configured one (a config change shouldn't need a re-sync).
const ALL_CITIES = [
  "Black Market",
  "Bridgewatch",
  "Caerleon",
  "Fort Sterling",
  "Lymhurst",
  "Martlock",
  "Thetford",
  "Brecilien",
];

// Farming/Crafting/Journals all address enchant-0 by the bare uniqueName;
// Crafting's craftItemId() does the same "@N" thing but that catalog is
// deliberately excluded from this cache (see schema.prisma) so it isn't
// needed here.

type FarmingRecipe = {
  kind: "crop" | "herb" | "animal";
  seedUniqueName?: string;
  outputUniqueName?: string;
  bonusLoot?: { uniqueName: string }[];
  babyUniqueName?: string;
  grownUniqueName?: string;
  product?: { outputUniqueName: string } | null;
};

function farmingItemIds(): Set<string> {
  const names = new Set<string>();
  const catalog = farmingCatalog as unknown as {
    recipes: FarmingRecipe[];
    foods: { uniqueName: string }[];
  };
  for (const recipe of catalog.recipes) {
    if (recipe.kind === "crop" || recipe.kind === "herb") {
      if (recipe.seedUniqueName) names.add(recipe.seedUniqueName);
      if (recipe.outputUniqueName) names.add(recipe.outputUniqueName);
      for (const bonus of recipe.bonusLoot ?? []) names.add(bonus.uniqueName);
    } else if (recipe.kind === "animal") {
      if (recipe.babyUniqueName) names.add(recipe.babyUniqueName);
      if (recipe.grownUniqueName) names.add(recipe.grownUniqueName);
      if (recipe.product) names.add(recipe.product.outputUniqueName);
    }
  }
  for (const food of catalog.foods) names.add(food.uniqueName);
  return names;
}

type JournalLootEntry = { itemName: string } | { silverAmount: number };
type JournalRowLite = {
  uniqueName: string;
  loot: JournalLootEntry[];
  fillOptions: { uniqueName: string }[] | null;
};

function journalItemIds(): Set<string> {
  const names = new Set<string>();
  for (const row of journalCatalog as unknown as JournalRowLite[]) {
    names.add(journalMarketId(row.uniqueName, "empty"));
    names.add(journalMarketId(row.uniqueName, "full"));
    for (const entry of row.loot) {
      if ("itemName" in entry) names.add(resourceMarketId(entry.itemName));
    }
    for (const opt of row.fillOptions ?? []) names.add(resourceMarketId(opt.uniqueName));
  }
  return names;
}

type ResourceCatalogRow = { uniqueName: string };
type EquipmentCatalogRow = { uniqueName: string; recipes: { enchant: number }[] };

// resource-catalog.json's own uniqueName already fully encodes its enchant
// level (e.g. "T4_METALBAR_LEVEL1"), unlike equipment — resourceMarketId()
// derives the right AODP address from that directly, no separate enchant
// argument needed (same convention journalItemIds() above already uses for
// journal reward/fill materials).
function craftFinderResourceItemIds(): Set<string> {
  const names = new Set<string>();
  for (const row of resourceCatalog as unknown as ResourceCatalogRow[]) {
    names.add(resourceMarketId(row.uniqueName));
  }
  return names;
}

// Only the enchant-0 equipment universe is cached (see
// craft-finder-constants.ts for why) — enchant 1-4 stay live-proxied, same
// tradeoff already accepted for excluding /crafting's whole catalog.
// Ranking only ever considers quality 1 (Craft Finder's own scope, per the
// user), so unlike this cache's original design there's no separate
// higher-cardinality quality dimension to isolate onto its own slower sync
// cycle anymore — quality 1 alone is the same order of magnitude as
// Farming/Journals' own universe, so it joins their cycle below.
function craftFinderEquipmentItemIds(): Set<string> {
  const names = new Set<string>();
  for (const item of [...craftingCatalog, ...foodCatalog] as unknown as EquipmentCatalogRow[]) {
    if (item.recipes.some((r) => r.enchant === CRAFT_FINDER_CACHED_ENCHANT)) {
      names.add(craftItemId(item.uniqueName, CRAFT_FINDER_CACHED_ENCHANT));
    }
  }
  return names;
}

// The cache's whole universe — see schema.prisma's CachedMarketPrice doc for
// why Crafting's own selection-driven queries and Market Prices' ad-hoc
// picks are excluded. Computed once at module load (these catalogs are
// static, committed JSON, not live data). Everything here is quality 1 only
// — Farming/Journals' items never vary quality, and Craft Finder ranks
// quality 1 exclusively.
export function priceCacheItemIds(): string[] {
  return [
    ...new Set([
      ...farmingItemIds(),
      ...journalItemIds(),
      ...craftFinderResourceItemIds(),
      ...craftFinderEquipmentItemIds(),
    ]),
  ];
}

const SYNC_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const UPSERT_CONCURRENCY = 25;

function upsertData(region: AodpRegion, row: AodpPriceRow) {
  return {
    itemId: row.item_id,
    city: row.city,
    quality: row.quality,
    region,
    sellPriceMin: row.sell_price_min,
    sellPriceMinDate: row.sell_price_min_date,
    sellPriceMax: row.sell_price_max,
    sellPriceMaxDate: row.sell_price_max_date,
    buyPriceMin: row.buy_price_min,
    buyPriceMinDate: row.buy_price_min_date,
    buyPriceMax: row.buy_price_max,
    buyPriceMaxDate: row.buy_price_max_date,
  };
}

async function syncRegion(region: AodpRegion, items: string[]): Promise<void> {
  if (items.length === 0) return;
  const rows = await fetchCurrentPrices(region, items, ALL_CITIES, [1]);

  for (let i = 0; i < rows.length; i += UPSERT_CONCURRENCY) {
    const batch = rows.slice(i, i + UPSERT_CONCURRENCY);
    await Promise.all(
      batch.map((row) => {
        const data = upsertData(region, row);
        return prisma.cachedMarketPrice.upsert({
          where: {
            itemId_city_quality_region: {
              itemId: data.itemId,
              city: data.city,
              quality: data.quality,
              region: data.region,
            },
          },
          create: data,
          update: data,
        });
      }),
    );
  }
}

let syncing = false;

// Exported for a future manual "Refresh cache now" admin action, if ever
// wanted — not currently wired to anything but startPriceCacheSync's own
// interval below. Every item in this universe is quality 1 only (see
// schema.prisma's doc) — no need to ask AODP for qualities 2-5.
export async function syncPriceCacheOnce(): Promise<void> {
  if (syncing) return; // a run overlapping the next interval tick shouldn't stack
  syncing = true;
  const startedAt = Date.now();
  try {
    const items = priceCacheItemIds();
    for (const region of AODP_REGIONS) {
      try {
        await syncRegion(region, items);
      } catch (err) {
        console.error(`Price cache sync failed for ${region}`, err);
      }
    }
    console.log(
      `Price cache sync: ${items.length} items × ${AODP_REGIONS.length} regions in ${Date.now() - startedAt}ms`,
    );
  } finally {
    syncing = false;
  }
}

const globalForSync = globalThis as unknown as { priceCacheSyncStarted?: boolean };

// Called once from src/instrumentation.ts's register() when the server
// starts. Guarded on globalThis (same pattern as src/lib/prisma.ts) so
// Next.js dev-mode HMR reloading this module doesn't stack up duplicate
// intervals — module-scope state alone doesn't survive a Turbopack re-eval,
// globalThis does.
export function startPriceCacheSync(): void {
  if (globalForSync.priceCacheSyncStarted) return;
  globalForSync.priceCacheSyncStarted = true;

  // Fire-and-forget: instrumentation's register() must complete before the
  // server accepts requests, and the first sync (rate-limited against AODP,
  // across 3 regions) can take a little while — don't delay boot on it.
  // Until it completes, /api/market/prices' cache-miss fallback (see that
  // route) serves these items live instead, same as before this existed.
  syncPriceCacheOnce().catch((err) => console.error("Initial price cache sync failed", err));
  setInterval(() => {
    syncPriceCacheOnce().catch((err) => console.error("Price cache sync failed", err));
  }, SYNC_INTERVAL_MS);
}
