import { NextResponse } from "next/server";
import equipment from "@/data/crafting-catalog.json";
import resources from "@/data/resource-catalog.json";

// Serves both catalogs Craft Finder needs together: crafting-catalog.json
// (768 equipment recipes, already built for /crafting) for the tree's top
// layer, and resource-catalog.json (built by
// scripts/build-resource-catalog.mjs specifically for this feature) for
// every refining/transmutation step below it. Module-scope static import,
// same pattern as /api/crafting/recipes and /api/market/items.
export async function GET() {
  return NextResponse.json({ equipment, resources });
}
