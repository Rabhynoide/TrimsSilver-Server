import { NextRequest, NextResponse } from "next/server";
import { fetchAveragePrices, fetchCurrentPrices, isAodpRegion, priceKey } from "@/lib/aodp";

const MAX_ITEMS = 100;

// Live proxy to AODP's public stats API for the Market Prices page — see
// PROJECT_STATUS.md's "Market Prices" section. Not persisted server-side.
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
    const [current, averages] = await Promise.all([
      fetchCurrentPrices(region, items, locations, qualities),
      averageDays && averageDays > 0
        ? fetchAveragePrices(region, items, locations, qualities, averageDays)
        : Promise.resolve(new Map<string, number>()),
    ]);

    const rows = current.map((row) => ({
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
      avgPrice: averages.get(priceKey(row.item_id, row.city, row.quality)) ?? null,
    }));

    return NextResponse.json({ prices: rows });
  } catch (err) {
    console.error("Market prices proxy failed", err);
    return NextResponse.json({ error: "Failed to fetch prices from AODP" }, { status: 502 });
  }
}
