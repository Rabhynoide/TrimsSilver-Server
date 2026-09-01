import { NextRequest, NextResponse } from "next/server";
import { isAodpRegion } from "@/lib/aodp";
import { getMarketPrices } from "@/lib/marketPricesService";

// A sanity ceiling on one request, not AODP's real constraint — aodp.ts's
// fetchCurrentPrices/fetchAveragePrices internally batch by actual URL
// length against AODP's documented 4096-char limit (and rate-limit/retry
// against its 180/min-300/5min ceilings), so a large item list here is
// still safe; this just guards against one client sending something absurd.
const MAX_ITEMS = 500;

// Shared proxy behind Market Prices, Farming, Crafting, Journals, and
// Flipper's Public Flips (Craft Finder's own bulk ranking need is served by
// /api/craft-finder/prices instead — see that route's comment). The actual
// price-fetching logic (cache-then-live-fallback) lives in
// src/lib/marketPricesService.ts, shared by both routes.
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

  try {
    const prices = await getMarketPrices({ region, items, locations, qualities, averageDays });
    return NextResponse.json({ prices });
  } catch (err) {
    console.error("Market prices proxy failed", err);
    return NextResponse.json(
      { error: "Échec de la récupération des prix depuis AODP", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
