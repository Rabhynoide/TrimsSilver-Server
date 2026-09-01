// Regenerates src/data/food-catalog.json from ao-data/ao-bin-dumps — the actively maintained
// fork (broderickhyman/ao-bin-dumps, used previously, was archived in Jan
// 2023 and stopped tracking patches years ago).
// Run manually after major Albion Online game patches: npm run food-catalog:build
//
// Source: items.json (raw), `consumableitem` bucket's `food` (meals) and
// `potions` subcategories only — confirmed by direct inspection these are
// the two real craftable-for-profit consumable families (`fish` is a raw
// ingredient, not a craft output, handled by build-resource-catalog.mjs
// instead; `other` is event/vanity food, out of scope). Re-verified against
// a live 2026-08-31 data pull: `@shopsubcategory1` values here were renamed
// at some point since (was `cooked`/`potion`, singular) — see
// build-resource-catalog.mjs's header comment for the fuller story of this
// schema drift, discovered the same session. `@craftingcategory` (below)
// is unaffected, still singular "food"/"potion". Same `CraftItem`/
// `CraftRecipe` shape as crafting-catalog.json
// (uniqueName/specAchievementId/workshop/craftingCategory/recipes), kept as
// a separate file/script rather than folded into that one so `/crafting`
// itself (which deliberately excludes food/potions, see that script's own
// header) is untouched.
//
// Two real differences from equipment, both confirmed by inspection:
// - Enchant levels only go 0-3 here (not 0-4) — same
//   `enchantments.enchantment[]` structure, just fewer of them in the data.
// - `@amountcrafted` is frequently >1 (a batch of 5 or 10 per craft action
//   is common for potions/food, unlike equipment which is always 1) — kept
//   on each recipe so craft-finder/calc.ts can divide down to a true
//   per-unit cost.
//
// `workshop`/`craftingCategory`: every item here carries a uniform
// `@craftingcategory` of "food" or "potion" (never a per-meal-type or
// per-potion-type value, unlike equipment's per-weapon-type categories) —
// mapped 1:1 to the real building: Kitchen ("cooking") for food, Alchemist's
// Lab ("alchemy") for potions. This also means the city Local Production
// Bonus crafting specialty for these (Caerleon → all cooked food, Brecilien
// → all potions — see craft-finder-constants.ts's
// CRAFTING_SPECIALTY_CITY_BY_CATEGORY) is a real, whole-category match, not
// the per-item-type approximation equipment needs.
//
// No `specAchievementId` here — cooking/alchemy specialization uses a
// different achievement mechanism than equipment's `@combatspecachievement`
// (not identified this session), so it's always null, same documented gap
// pattern as equipment items that lack the field.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const RAW_ITEMS_URL =
  "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.json";

const OUTPUT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "data",
  "food-catalog.json",
);

const SUBCATEGORY_TO_WORKSHOP = { food: "cooking", potions: "alchemy" };

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function buildResources(craftingrequirements) {
  return asArray(craftingrequirements?.craftresource).map((r) => ({
    uniqueName: r["@uniquename"],
    count: parseInt(r["@count"], 10),
  }));
}

function buildRecipe(enchant, craftingrequirements) {
  if (!craftingrequirements) return null;
  const resources = buildResources(craftingrequirements);
  if (resources.length === 0) return null;
  return {
    enchant,
    silver: parseInt(craftingrequirements["@silver"] ?? "0", 10),
    focusCost: parseInt(craftingrequirements["@craftingfocus"] ?? "0", 10),
    amountCrafted: parseInt(craftingrequirements["@amountcrafted"] ?? "1", 10),
    resources,
  };
}

function buildRecipesForItem(entry) {
  const recipes = [];
  const base = buildRecipe(0, entry.craftingrequirements);
  if (base) recipes.push(base);

  for (const ench of asArray(entry.enchantments?.enchantment)) {
    const level = parseInt(ench["@enchantmentlevel"], 10);
    const recipe = buildRecipe(level, ench.craftingrequirements);
    if (recipe) recipes.push(recipe);
  }
  return recipes;
}

function extractCatalog(rawItems) {
  const rows = [];
  for (const entry of asArray(rawItems.items.consumableitem)) {
    const uniqueName = entry["@uniquename"];
    const workshop = SUBCATEGORY_TO_WORKSHOP[entry["@shopsubcategory1"]];
    if (!uniqueName || !workshop) continue;
    if (entry["@showinmarketplace"] === "false") continue;
    if (entry["@hidefromplayer"] === "true") continue;

    const recipes = buildRecipesForItem(entry);
    if (recipes.length === 0) continue;

    rows.push({
      uniqueName,
      specAchievementId: null,
      workshop,
      craftingCategory: entry["@craftingcategory"] ?? null,
      recipes,
    });
  }
  rows.sort((a, b) => a.uniqueName.localeCompare(b.uniqueName));
  return rows;
}

async function main() {
  console.log("Fetching ao-bin-dumps item data...");
  const rawItems = await fetchJson(RAW_ITEMS_URL);

  const catalog = extractCatalog(rawItems);

  writeFileSync(OUTPUT_PATH, JSON.stringify(catalog), "utf-8");
  console.log(`Wrote ${catalog.length} craftable food/potion items to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
