import { NextRequest, NextResponse } from "next/server";
import craftingCatalog from "@/data/crafting-catalog.json";
import foodCatalog from "@/data/food-catalog.json";
import resourceCatalog from "@/data/resource-catalog.json";
import { craftItemId } from "@/app/crafting/calc";
import { resourceMarketId } from "@/data/journal-constants";
import { CITIES } from "@/app/market-prices/types";
import { CRAFT_FINDER_REGION } from "@/app/craft-finder/types";
import { getMarketPrices } from "@/lib/marketPricesService";
import { requireFullAccess } from "@/lib/access";

type EquipmentCatalogRow = { uniqueName: string; recipes: { enchant: number }[] };
type ResourceCatalogRow = { uniqueName: string };

function parseEnchants(raw: string | null): number[] {
  const values = (raw ?? "0")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 4);
  return values.length > 0 ? [...new Set(values)] : [0];
}

// Craft Finder's ranking prices its ENTIRE catalog on every refresh (768
// equipment + 74 food/potion ids across every selected enchant level +
// ~330 resource/ingredient-layer ids, all 8 cities) — far more than any
// other feature. Only quality 1 is
// ranked (per the feature's own scope), which keeps this to one dimension
// instead of the five Market Prices/Crafting need. Routing this through
// /api/market/prices from the browser would need many chunked requests, and
// that request *count* itself turned out to be the real problem: reproduced
// live against production that a burst of that many browser-facing
// requests in a few seconds escalates through BunkerWeb's anti-abuse
// handling (403, then 429, then 502, worsening across the burst) — not a
// per-request content or length issue, which earlier diagnosis had wrongly
// pinned it on (see PROJECT_STATUS.md for the full story).
//
// The fix: collapse this into ONE browser-facing request. This route
// computes Craft Finder's item universe itself (mirroring the same closure
// CraftFinderApp.tsx used to build client-side) and calls
// src/lib/marketPricesService.ts's getMarketPrices() directly, in-process —
// no HTTP hop, so the heavy AODP/cache work never touches BunkerWeb's
// client-facing WAF at all, only this one small request does.
export async function GET(request: NextRequest) {
  const access = await requireFullAccess();
  if (!access.ok) return access.response;

  const params = request.nextUrl.searchParams;
  const enchants = parseEnchants(params.get("enchants") ?? params.get("enchant"));

  const averageDaysParam = params.get("averageDays");
  const averageDays = averageDaysParam ? parseInt(averageDaysParam, 10) : null;

  const equipmentIds = new Set<string>();
  for (const item of [...craftingCatalog, ...foodCatalog] as unknown as EquipmentCatalogRow[]) {
    for (const enchant of enchants) {
      if (item.recipes.some((r) => r.enchant === enchant)) {
        equipmentIds.add(craftItemId(item.uniqueName, enchant));
      }
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
      qualities: [1],
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
