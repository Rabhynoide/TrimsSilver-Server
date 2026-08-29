import { NextRequest, NextResponse } from "next/server";
import { AverageEntry, fetchAveragePrices, fetchCurrentPrices, isAodpRegion, priceKey } from "@/lib/aodp";
import { prisma } from "@/lib/prisma";

// A sanity ceiling on one request, not AODP's real constraint — aodp.ts's
// fetchCurrentPrices/fetchAveragePrices internally batch by actual URL
// length against AODP's documented 4096-char limit (and rate-limit/retry
// against its 180/min-300/5min ceilings), so a large item list here is
// still safe; this just guards against one client sending something absurd.
const MAX_ITEMS = 500;

type PriceRowOut = {
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

// Shared proxy behind Market Prices, Farming, Crafting, Journals, and
// Flipper's Public Flips. Current prices are served from the market-price
// cache (src/lib/priceCacheSync.ts) wherever available — Farming/Journals'
// item universes are cached in full, kept warm by a background sync job, so
// their refreshes are normally a DB read with no AODP call at all. Anything
// not in the cache (Market Prices' ad-hoc item picks, Crafting's per-
// selection queries, or the cache simply not synced yet right after a
// deploy) falls straight back to a live AODP fetch for just those items —
// the same live-proxy behavior this route always had. Average prices are
// always live: they're parameterized by a user-chosen day window, which
// isn't practical to pre-cache for every possible value.
//
// Known minor gap: the cache-hit check is per item, not per (item, quality)
// — an item that's cached (quality 1 only, see schema.prisma) but requested
// at qualities 2-5 (e.g. a farmable happens to be looked up via Market
// Prices, which always asks for 1-5) won't get a live top-up for those
// missing qualities. Harmless in practice: farmables/journal materials
// never actually have quality 2-5 listings on AODP either way.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const region = params.get("region") ?? "";
  if (!isAodpRegion(region)) {
    return NextResponse.json(
      { error: "region must be one of Americas, Asia, Europe" },
      { status: 400 },
    );
  }

  const items = (params.get("items") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const locations = (params.get("locations") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const qualities = (params.get("qualities") ?? "1,2,3,4,5")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5);

  if (items.length === 0 || locations.length === 0) {
    return NextResponse.json({ error: "items and locations are required" }, { status: 400 });
  }
  if (items.length > MAX_ITEMS) {
    return NextResponse.json({ error: `Too many items (max ${MAX_ITEMS})` }, { status: 400 });
  }

  const averageDaysParam = params.get("averageDays");
  const averageDays = averageDaysParam ? parseInt(averageDaysParam, 10) : null;

  // A cache read failure (e.g. the DB being briefly unreachable) shouldn't
  // take the whole route down — this route was a pure live proxy before the
  // cache existed, so degrade to that instead of erroring out.
  let cached: Awaited<ReturnType<typeof prisma.cachedMarketPrice.findMany>> = [];
  try {
    cached = await prisma.cachedMarketPrice.findMany({
      where: { region, itemId: { in: items }, city: { in: locations }, quality: { in: qualities } },
    });
  } catch (err) {
    console.error("Price cache read failed, falling back to a fully live fetch", err);
  }

  try {
    const cachedItemIds = new Set(cached.map((c) => c.itemId));
    const liveItems = items.filter((id) => !cachedItemIds.has(id));

    const [live, averages] = await Promise.all([
      liveItems.length > 0
        ? fetchCurrentPrices(region, liveItems, locations, qualities)
        : Promise.resolve([]),
      averageDays && averageDays > 0
        ? fetchAveragePrices(region, items, locations, qualities, averageDays)
        : Promise.resolve(new Map<string, AverageEntry>()),
    ]);

    const rows: PriceRowOut[] = [
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

    return NextResponse.json({ prices: rows });
  } catch (err) {
    console.error("Market prices proxy failed", err);
    return NextResponse.json(
      { error: "Failed to fetch prices from AODP", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
