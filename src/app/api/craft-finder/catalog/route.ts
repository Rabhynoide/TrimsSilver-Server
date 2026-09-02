import { NextResponse } from "next/server";
import equipmentCatalog from "@/data/crafting-catalog.json";
import foodCatalog from "@/data/food-catalog.json";
import resources from "@/data/resource-catalog.json";
import { requireFullAccess } from "@/lib/access";

// Serves both catalogs Craft Finder needs together: crafting-catalog.json +
// food-catalog.json (768 equipment + 74 food/potion recipes, the latter
// built by scripts/build-food-catalog.mjs) merged into one `equipment` array
// for the tree's top layer — both share the exact same CraftItem shape, so
// the client treats them identically, it never needs to know which catalog
// an item came from — and resource-catalog.json (built by
// scripts/build-resource-catalog.mjs, now also covering the food/potion
// ingredient chain: crops, fish, and intermediate cooking products) for
// every refining/ingredient step below it. Module-scope static import, same
// pattern as /api/crafting/recipes and /api/market/items.
export async function GET() {
  const access = await requireFullAccess();
  if (!access.ok) return access.response;

  return NextResponse.json({ equipment: [...equipmentCatalog, ...foodCatalog], resources });
}
