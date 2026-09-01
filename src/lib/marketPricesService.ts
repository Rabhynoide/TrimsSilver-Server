// Core price-fetching logic shared by /api/market/prices (the public,
// client-chunked route every feature's browser code calls) and
// /api/craft-finder/prices (a server-side aggregation route — see that
// file's own comment for why Craft Finder needed a second entry point
// instead of just calling this same route many times from the browser).
// Extracted so both call sites share one implementation rather than the
// aggregation route re-implementing the cache-then-live-fallback logic.

import { AverageEntry, AodpRegion, fetchAveragePrices, fetchCurrentPrices, priceKey } from "./aodp";
import { prisma } from "./prisma";

export type PriceRowOut = {
  itemId: string;
  city: string;
  quality: number;
  sellPriceMin: number;
  sellPriceMinDate: string;
  sellPriceMax: number;
  sellPriceMaxDate: string;
  buyPriceMin: number;
  buyPriceMinDate: string;
  buyPriceMax: number;
  buyPriceMaxDate: string;
  avgPrice: number | null;
  avgAmount: number | null;
};

export type GetMarketPricesParams = {
  region: AodpRegion;
  items: string[];
  locations: string[];
  qualities: number[];
  averageDays: number | null;
};

// Current prices are served from the market-price cache
// (src/lib/priceCacheSync.ts) wherever available; anything not cached falls
// back to a live AODP fetch for just those items. Average prices are always
// live — parameterized by a user-chosen day window, not practical to
// pre-cache for every possible value. See schema.prisma's CachedMarketPrice
// doc for exactly which item universes are cached and why.
export async function getMarketPrices(params: GetMarketPricesParams): Promise<PriceRowOut[]> {
  const { region, items, locations, qualities, averageDays } = params;

  // A cache read failure (e.g. the DB being briefly unreachable) shouldn't
  // take the whole call down — degrade to a fully live fetch instead.
  let cached: Awaited<ReturnType<typeof prisma.cachedMarketPrice.findMany>> = [];
  try {
    cached = await prisma.cachedMarketPrice.findMany({
      where: { region, itemId: { in: items }, city: { in: locations }, quality: { in: qualities } },
    });
  } catch (err) {
    console.error("Price cache read failed, falling back to a fully live fetch", err);
  }

  const cachedItemIds = new Set(cached.map((c) => c.itemId));
  const liveItems = items.filter((id) => !cachedItemIds.has(id));

  const [live, averages] = await Promise.all([
    liveItems.length > 0 ? fetchCurrentPrices(region, liveItems, locations, qualities) : Promise.resolve([]),
    averageDays && averageDays > 0
      ? fetchAveragePrices(region, items, locations, qualities, averageDays)
      : Promise.resolve(new Map<string, AverageEntry>()),
  ]);

  return [
    ...cached.map((c) => {
      const average = averages.get(priceKey(c.itemId, c.city, c.quality));
      return {
        itemId: c.itemId,
        city: c.city,
        quality: c.quality,
        sellPriceMin: c.sellPriceMin,
        sellPriceMinDate: c.sellPriceMinDate,
        sellPriceMax: c.sellPriceMax,
        sellPriceMaxDate: c.sellPriceMaxDate,
        buyPriceMin: c.buyPriceMin,
        buyPriceMinDate: c.buyPriceMinDate,
        buyPriceMax: c.buyPriceMax,
        buyPriceMaxDate: c.buyPriceMaxDate,
        avgPrice: average?.avgPrice ?? null,
        avgAmount: average?.avgAmount ?? null,
      };
    }),
    ...live.map((row) => {
      const average = averages.get(priceKey(row.item_id, row.city, row.quality));
      return {
        itemId: row.item_id,
        city: row.city,
        quality: row.quality,
        sellPriceMin: row.sell_price_min,
        sellPriceMinDate: row.sell_price_min_date,
        sellPriceMax: row.sell_price_max,
        sellPriceMaxDate: row.sell_price_max_date,
        buyPriceMin: row.buy_price_min,
        buyPriceMinDate: row.buy_price_min_date,
        buyPriceMax: row.buy_price_max,
        buyPriceMaxDate: row.buy_price_max_date,
        avgPrice: average?.avgPrice ?? null,
        avgAmount: average?.avgAmount ?? null,
      };
    }),
  ];
}
