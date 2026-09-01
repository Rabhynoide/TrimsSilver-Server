// Merges freshly-scanned private MarketOrder rows into the AODP-derived
// price rows marketPricesService.ts already builds, wherever a private scan
// is more recent than what AODP itself is currently reporting.
//
// AODP's public API is only as fresh as the last time ANY player's client
// happened to open that city's market and upload to
// pow.*.albion-online-data.com — a listing can sit reported as "current" for
// hours after it's actually been bought out (confirmed live: T3_EGG's
// Lymhurst sell_price_min read 60 while the in-game market already showed
// 148, ~1h40 after AODP's own cached timestamp). TrimsSilver's client fork
// (TrimsSilver-Client) can upload the exact same scan straight to this
// server instead — tagged `MarketOrder.contributeToPublic: true` when the
// player opts in via the "Contribute to Public" checkbox nested under
// "Private Flips Mode" (see AlbionDataAvalonia/Views/MainView.axaml:298-311
// in that repo). That data was, until now, only ever read back for the
// uploader's own /flipper page (PROJECT_STATUS.md's server issue #13,
// "Public Flips" cross-uploader aggregation, was explicitly deferred past
// V1). This is that read side, scoped to just "prefer it when it's fresher"
// rather than the full Public Flips feature.
import { priceKey, REGION_SERVER_ID, type AodpRegion } from "./aodp";
import { prisma } from "./prisma";
import { resolveLocation } from "@/data/market-locations";
import type { PriceRowOut } from "./marketPricesService";

// A private scan older than this is treated as no better than AODP's own
// staleness — private uploads are only worth preferring while they're
// genuinely fresher, not as a second stale source. Tighter than
// RankingTable's general 12h "this might be stale" warning threshold since a
// live player-scanned order is meant to be near-real-time or not worth
// preferring at all.
const PRIVATE_ORDER_MAX_AGE_MS = 3 * 60 * 60 * 1000;

// MarketOrder stores the base uniqueName (`itemTypeId`, already including
// any resource "_LEVELN" infix) and the enchant separately (`enchantmentLevel`)
// — this reconstructs the single "@N"-suffixed itemId string every other
// price consumer in this codebase keys on (see crafting/calc.ts's
// craftItemId and journal-constants.ts's resourceMarketId).
function baseItemTypeId(itemId: string): string {
  const at = itemId.indexOf("@");
  return at === -1 ? itemId : itemId.slice(0, at);
}

type Side = { price: number; date: string };
export type FreshPrivateEntry = { sell?: { min: Side; max: Side }; buy?: { min: Side; max: Side } };

export async function fetchFreshPrivateOrders(
  region: AodpRegion,
  items: string[],
  locations: string[],
  qualities: number[],
): Promise<Map<string, FreshPrivateEntry>> {
  const result = new Map<string, FreshPrivateEntry>();

  const baseNames = [...new Set(items.map(baseItemTypeId))];
  if (baseNames.length === 0) return result;

  const itemSet = new Set(items);
  const locationSet = new Set(locations);
  const qualitySet = new Set(qualities);
  const cutoff = new Date(Date.now() - PRIVATE_ORDER_MAX_AGE_MS);

  // A cache/query failure here shouldn't take the whole price call down —
  // callers just get no private data to merge, same "degrade gracefully"
  // convention as marketPricesService.ts's own cache read.
  let rows: Awaited<ReturnType<typeof prisma.marketOrder.findMany>> = [];
  try {
    rows = await prisma.marketOrder.findMany({
      where: {
        serverId: REGION_SERVER_ID[region],
        contributeToPublic: true,
        itemTypeId: { in: baseNames },
        updatedAt: { gte: cutoff },
      },
    });
  } catch (err) {
    console.error("Private MarketOrder read failed, continuing without it", err);
    return result;
  }

  // Bucketed by (item, city, quality), tracking the best/worst currently-
  // known unit price per side — mirrors what sell_price_min/max and
  // buy_price_min/max mean in AODP's own API (see aodp.ts's AodpPriceRow).
  // Only the min sides actually get consumed downstream today (Craft Finder
  // buys at sell_price_min, the cheapest offer), both computed for parity
  // with the AODP-backed rows this merges into.
  type Bucket = { sellMin?: Side; sellMax?: Side; buyMin?: Side; buyMax?: Side };
  const buckets = new Map<string, Bucket>();

  for (const row of rows) {
    const enchant = row.enchantmentLevel || 0;
    const itemId = enchant > 0 ? `${row.itemTypeId}@${enchant}` : row.itemTypeId;
    if (!itemSet.has(itemId) || !qualitySet.has(row.qualityLevel) || row.auctionType === "unknown") continue;
    const { city } = resolveLocation(row.locationId);
    if (!city || !locationSet.has(city)) continue;

    const key = priceKey(itemId, city, row.qualityLevel);
    const bucket = buckets.get(key) ?? {};
    const entry: Side = { price: Number(row.unitPriceSilver), date: row.updatedAt.toISOString() };

    if (row.auctionType === "offer") {
      if (!bucket.sellMin || entry.price < bucket.sellMin.price) bucket.sellMin = entry;
      if (!bucket.sellMax || entry.price > bucket.sellMax.price) bucket.sellMax = entry;
    } else {
      if (!bucket.buyMin || entry.price < bucket.buyMin.price) bucket.buyMin = entry;
      if (!bucket.buyMax || entry.price > bucket.buyMax.price) bucket.buyMax = entry;
    }
    buckets.set(key, bucket);
  }

  for (const [key, bucket] of buckets) {
    result.set(key, {
      sell: bucket.sellMin && bucket.sellMax ? { min: bucket.sellMin, max: bucket.sellMax } : undefined,
      buy: bucket.buyMin && bucket.buyMax ? { min: bucket.buyMin, max: bucket.buyMax } : undefined,
    });
  }

  return result;
}

// Overwrites just the sides (sell/buy) where the private scan is strictly
// newer than what `row` already has — a private scan never makes a row
// worse or more stale, only ever fresher. Both fields of a side (min+max)
// are swapped together, gated on the min side's own date, rather than mixing
// a fresh min with a stale max within the same side.
export function applyFreshPrivateOrders(row: PriceRowOut, fresh: Map<string, FreshPrivateEntry>): PriceRowOut {
  const entry = fresh.get(priceKey(row.itemId, row.city, row.quality));
  if (!entry) return row;

  let next = row;
  if (entry.sell && new Date(entry.sell.min.date).getTime() > new Date(next.sellPriceMinDate).getTime()) {
    next = {
      ...next,
      sellPriceMin: entry.sell.min.price,
      sellPriceMinDate: entry.sell.min.date,
      sellPriceMax: entry.sell.max.price,
      sellPriceMaxDate: entry.sell.max.date,
    };
  }
  if (entry.buy && new Date(entry.buy.min.date).getTime() > new Date(next.buyPriceMinDate).getTime()) {
    next = {
      ...next,
      buyPriceMin: entry.buy.min.price,
      buyPriceMinDate: entry.buy.min.date,
      buyPriceMax: entry.buy.max.price,
      buyPriceMaxDate: entry.buy.max.date,
    };
  }
  return next;
}

// A private-only row for a key AODP had nothing for at all (e.g. a
// low-traffic resource nobody's client has polled recently, but a
// guildmate happened to browse it in-game) — always has at least one side,
// callers only build this for keys fetchFreshPrivateOrders actually
// returned an entry for.
export function privateOnlyRow(itemId: string, city: string, quality: number, entry: FreshPrivateEntry): PriceRowOut {
  return {
    itemId,
    city,
    quality,
    sellPriceMin: entry.sell?.min.price ?? 0,
    sellPriceMinDate: entry.sell?.min.date ?? "",
    sellPriceMax: entry.sell?.max.price ?? 0,
    sellPriceMaxDate: entry.sell?.max.date ?? "",
    buyPriceMin: entry.buy?.min.price ?? 0,
    buyPriceMinDate: entry.buy?.min.date ?? "",
    buyPriceMax: entry.buy?.max.price ?? 0,
    buyPriceMaxDate: entry.buy?.max.date ?? "",
    avgPrice: null,
    avgAmount: null,
  };
}
