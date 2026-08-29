import { NextRequest, NextResponse } from "next/server";
import { fetchPriceHistorySeries, isAodpRegion } from "@/lib/aodp";

const MAX_DAYS = 180;

// Raw time series for the Market Prices detail chart — a single item/city/
// quality, unlike /api/market/prices' cross product. Not persisted server-side.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const region = params.get("region") ?? "";
  if (!isAodpRegion(region)) {
    return NextResponse.json(
      { error: "region must be one of Americas, Asia, Europe" },
      { status: 400 },
    );
  }

  const item = params.get("item") ?? "";
  const city = params.get("city") ?? "";
  const quality = parseInt(params.get("quality") ?? "", 10);
  const days = parseInt(params.get("days") ?? "30", 10);

  if (!item || !city) {
    return NextResponse.json({ error: "item and city are required" }, { status: 400 });
  }
  if (!Number.isInteger(quality) || quality < 1 || quality > 5) {
    return NextResponse.json({ error: "quality must be an integer 1-5" }, { status: 400 });
  }
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    return NextResponse.json({ error: `days must be an integer 1-${MAX_DAYS}` }, { status: 400 });
  }

  try {
    const history = await fetchPriceHistorySeries(region, item, city, quality, days);
    return NextResponse.json({ history });
  } catch (err) {
    console.error("Market history proxy failed", err);
    return NextResponse.json(
      { error: "Échec de la récupération de l'historique depuis AODP", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
