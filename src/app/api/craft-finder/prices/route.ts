import { NextRequest, NextResponse } from "next/server";
import craftingCatalog from "@/data/crafting-catalog.json";
import resourceCatalog from "@/data/resource-catalog.json";
import { craftItemId } from "@/app/crafting/calc";
import { resourceMarketId } from "@/data/journal-constants";
import { CITIES } from "@/app/market-prices/types";
import { CRAFT_FINDER_REGION } from "@/app/craft-finder/types";
import { getMarketPrices } from "@/lib/marketPricesService";

type EquipmentCatalogRow = { uniqueName: string; recipes: { enchant: number }[] };
type ResourceCatalogRow = { uniqueName: string };

// Craft Finder's ranking prices its ENTIRE catalog on every refresh (768
// equipment ids at one enchant level + ~230 resource-layer ids, all 8
// cities, qualities 1-5) — far more than any other feature. Routing that
// through /api/market/prices from the browser needs ~19-23 chunked
// requests even at a conservative per-request size, and that request
// *count* itself turned out to be the real problem: reproduced live against
// production that a burst of that many browser-facing requests in a few
// seconds escalates through BunkerWeb's anti-abuse handling (403, then 429,
// then 502, worsening across the burst) — not a per-request content or
// length issue, which earlier diagnosis had wrongly pinned it on (see
// PROJECT_STATUS.md for the full story, including the diagnostic dead end).
//
// The fix: collapse this into ONE browser-facing request. This route
// computes Craft Finder's item universe itself (mirroring the same closure
// CraftFinderApp.tsx used to build client-side) and calls
// src/lib/marketPricesService.ts's getMarketPrices() directly, in-process —
// no HTTP hop, so the heavy AODP/cache work never touches BunkerWeb's
// client-facing WAF at all, only this one small request does.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const enchantParam = parseInt(params.get("enchant") ?? "0", 10);
  const enchant = Number.isInteger(enchantParam) && enchantParam >= 0 && enchantParam <= 4 ? enchantParam : 0;

  const averageDaysParam = params.get("averageDays");
  const averageDays = averageDaysParam ? parseInt(averageDaysParam, 10) : null;

  const equipmentIds: string[] = [];
  for (const item of craftingCatalog as unknown as EquipmentCatalogRow[]) {
    if (item.recipes.some((r) => r.enchant === enchant)) {
      equipmentIds.push(craftItemId(item.uniqueName, enchant));
    }
  }
  const resourceIds = (resourceCatalog as unknown as ResourceCatalogRow[]).map((r) =>
    resourceMarketId(r.uniqueName),
  );

  try {
    const prices = await getMarketPrices({
      region: CRAFT_FINDER_REGION,
      items: [...equipmentIds, ...resourceIds],
      locations: [...CITIES],
      qualities: [1, 2, 3, 4, 5],
      averageDays: averageDays && averageDays > 0 ? averageDays : null,
    });
    return NextResponse.json({ prices });
  } catch (err) {
    console.error("Craft Finder price aggregation failed", err);
    return NextResponse.json(
      { error: "Échec de la récupération des prix", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
