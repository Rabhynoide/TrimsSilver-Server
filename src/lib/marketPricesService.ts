// Core price-fetching logic shared by /api/market/prices (the public,
// client-chunked route every feature's browser code calls) and
// /api/craft-finder/prices (a server-side aggregation route — see that
// file's own comment for why Craft Finder needed a second entry point
// instead of just calling this same route many times from the browser).
// Extracted so both call sites share one implementation rather than the
// aggregation route re-implementing the cache-then-live-fallback logic.

import { AverageEntry, AodpRegion, fetchAveragePrices, fetchCurrentPrices, priceKey } from "./aodp";
import { prisma } from "./prisma";
import { applyFreshPrivateOrders, fetchFreshPrivateOrders, privateOnlyRow } from "./privateMarketOrders";

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
//
// A third source, fresh opted-in private MarketOrder scans, is merged on top
// of both — see privateMarketOrders.ts's own header comment for why: AODP
// itself can be hours stale for a given (item, city, quality), and a
// TrimsSilver-Client user's own recent market visit is often fresher than
// AODP's last poll of that same market.
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

  const [live, averages, freshPrivate] = await Promise.all([
    liveItems.length > 0 ? fetchCurrentPrices(region, liveItems, locations, qualities) : Promise.resolve([]),
    averageDays && averageDays > 0
      ? fetchAveragePrices(region, items, locations, qualities, averageDays)
      : Promise.resolve(new Map<string, AverageEntry>()),
    fetchFreshPrivateOrders(region, items, locations, qualities),
  ]);

  const rows: PriceRowOut[] = [
    ...cached.map((c) => {
      const average = averages.get(priceKey(c.itemId, c.city, c.quality));
      return applyFreshPrivateOrders(
        {
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
        },
        freshPrivate,
      );
    }),
    ...live.map((row) => {
      const average = averages.get(priceKey(row.item_id, row.city, row.quality));
      return applyFreshPrivateOrders(
        {
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
        },
        freshPrivate,
      );
    }),
  ];

  // Private-only coverage: a key AODP reported nothing for at all, but a
  // fresh private scan exists for it.
  const covered = new Set(rows.map((r) => priceKey(r.itemId, r.city, r.quality)));
  for (const [key, entry] of freshPrivate) {
    if (covered.has(key)) continue;
    const [itemId, city, qualityStr] = key.split("|");
    rows.push(privateOnlyRow(itemId, city, Number(qualityStr), entry));
  }

  return rows;
}
