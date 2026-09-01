// Regenerates src/data/resource-catalog.json from ao-data/ao-bin-dumps — the
// actively maintained fork (broderickhyman/ao-bin-dumps, used previously,
// was archived in Jan 2023 and stopped tracking patches years ago).
// Run manually after major Albion Online game patches: npm run resource-catalog:build
//
// Source: items.json (raw) only, `simpleitem` bucket (plus one loop over
// `consumableitem` for fish, see below) — confirmed by direct inspection
// that raw resources, refined resources, and the food/potion ingredient
// chain all live here, not in `weapon`/`equipmentitem`
// (crafting-catalog.json's own scope). This is the piece the Crafting
// Calculator never needed: the resource-refining chain down to raw
// materials, required for Craft Finder's make-or-buy tree.
//
// Category schema (re-verified against a live 2026-08-31 data pull after
// this file was found broken against it — see PROJECT_STATUS.md for the
// full incident): items are grouped by a COARSE `@shopsubcategory1`
// ("resources", "refinedresources", "farm", "herbgarden", "pasture",
// "farmingproducts", "alchemy" — everything else in the bucket is out of
// scope for both equipment and food/potion crafting), with the actual fine
// category (ore/wood/metalbars/planks/flour/essence/etc.) one level down in
// `@shopsubcategory2`. This replaced an older single-level scheme (where
// `@shopsubcategory1` itself was "ore"/"metalbar"/"farming"/"cooked"/
// "essence") at some point in the ~4 years broderickhyman/ao-bin-dumps went
// unmaintained — this script was silently returning near-empty output
// against the new schema (40 rows instead of ~330) until this rewrite.
// `@shopsubcategory2` values are stable 1:1 with the old scheme except
// "metalbars" (was "metalbar", singular) — normalized back to "metalbar" in
// CATEGORY_ALIASES below so every OTHER file in this codebase (the config
// UI, CRAFTING_SPECIALTY_CITY_BY_CATEGORY, etc.) keeps using the same
// category name it always has, insulated from this raw-data rename.
//
// Unlike equipment (crafting-catalog.json), an enchanted resource is NOT a
// nested `enchantments.enchantment[]` entry on a base item — each enchant
// level is its OWN standalone top-level `simpleitem` entry (its own
// `@uniquename` like "T4_METALBAR_LEVEL1") with its OWN independent
// `craftingrequirements`, confirmed by direct inspection. So this script
// scans every entry individually rather than walking a parent's enchant
// array.
//
// Also confirmed by inspection: a refined resource's `craftingrequirements`
// is sometimes an ARRAY of alternative recipes, not just for "faction token"
// variants (which this script filters out) but also for genuinely distinct
// legitimate paths — e.g. T5_WOOD_LEVEL1 can be made either from 1x
// T4_WOOD_LEVEL1 (a tier-up transmutation) or 1x T5_WOOD (a same-tier
// enchant transmutation), both silver-only, no faction token. Rather than
// guessing which one is "the" recipe, every non-faction option is kept — the
// make-or-buy evaluator tries each option and picks the cheapest, the same
// way it already picks between buy vs craft.
//
// Raw resources (ore/wood/hide/fiber/rock) are recorded here too, but
// deliberately WITHOUT their crafting/transmutation options even when the
// raw data has them (an enchanted raw resource like T4_ORE_LEVEL1 does carry
// a silver-only "Resource Transmutation" recipe converting the base resource
// up an enchant level — by design decision, not modeled: they're kept as
// pure market-price leaves in the make-or-buy tree instead). They're still
// included as rows here (with `options: []`) purely to carry their own
// `itemValue` — needed as an input wherever a refined-resource or equipment
// recipe consumes a raw resource directly (e.g. T1 tools use T1_WOOD/T1_ROCK
// with no refining step in between) for Craft Finder's station-fee formula
// (see calc.ts).
//
// `itemValue` (`@itemvalue`) is the resource's own stored game-data value —
// used directly for its own crafting-station Nutrition Cost (Nutrition Cost
// = Item Value × 0.1125, confirmed against Albion's official "Usage Fee and
// Crafting Changes" patch notes) and, for raw resources, as an input to the
// consuming recipe's own derived Item Value.
//
// Food/potion ingredient chain (for Craft Finder's Cooking/Alchemy
// support): `farm`/`herbgarden`/`pasture` are crops/herbs/animal products
// (e.g. T1_CARROT, T2_AGARIC, T4_MILK) — always leaves, no
// `craftingrequirements` of their own. `farmingproducts` is intermediate
// cooking products with their own recipe (e.g. T3_FLOUR → T4_BREAD,
// T3_WHEAT → T3_FLOUR). `simpleitem`'s OWN `fish` subcategory (distinct
// from `consumableitem`'s `fish` handled separately below) is the
// fish-sauce chain (T1_FISHCHOPS + T1_SEAWEED → T1_FISHSAUCE_LEVELN).
// `alchemy` is Essence Potion's ingredient chain and the newer
// monster-part-based potion ingredients (remains_*/dragonblood/extract) —
// all handled the same generic way. One dead end, confirmed deliberate not
// a gap: the root `T*_ESSENCE` items have neither a stored `@itemvalue` nor
// any `craftingrequirements` (a Hellgate/Mists-only rare drop, not a normal
// market resource) — falls back to `itemValue: 0` like anything else with
// no data, a narrow, low-impact gap (only affects Essence Potion's own
// derived Item Value).

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const RAW_ITEMS_URL = "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.json";

const OUTPUT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "data",
  "resource-catalog.json",
);

// `@shopsubcategory1` → { kind, category (if fixed) }. `kind: "raw"` skips
// recipe extraction (see the header comment); everything else attempts it.
// "material-raw"/"material-refined" read the actual category from
// `@shopsubcategory2` (via categoryFor below); the food/potion buckets each
// map to one fixed node category instead, since none of them need finer
// granularity than "cooking" vs "alchemy" (unlike equipment's per-item-type
// specialty, a food/potion city specialty is already whole-category, see
// craft-finder-constants.ts).
const SUBCATEGORY1_KIND = {
  resources: "material-raw",
  refinedresources: "material-refined",
  farm: "food-leaf",
  herbgarden: "food-leaf",
  pasture: "food-leaf",
  farmingproducts: "food-recipe",
  fish: "food-recipe", // simpleitem's OWN `fish` (fish-sauce chain) — see header comment
  alchemy: "food-recipe",
};

const FOOD_KIND_CATEGORY = { farm: "cooking", herbgarden: "cooking", pasture: "cooking", farmingproducts: "cooking", fish: "cooking", alchemy: "alchemy" };

// `@shopsubcategory2` values that don't match this app's existing category
// names elsewhere (config UI, CRAFTING_SPECIALTY_CITY_BY_CATEGORY) — see
// this file's header comment for why "metalbars" needs normalizing back to
// "metalbar" rather than propagating the raw-data rename everywhere else.
const CATEGORY_ALIASES = { metalbars: "metalbar" };

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

// Faction Warfare token recipes are the same underlying craft with a bonus
// token requirement layered on top (e.g. an extra `T1_FACTION_MOUNTAIN_TOKEN_1`
// ingredient) — not a genuinely cheaper/different path a non-faction player
// can use, so they're excluded rather than offered as a real alternative.
function isFactionResource(uniqueName) {
  return uniqueName.includes("FACTION") || uniqueName.includes("TOKEN");
}

function buildRecipeOption(craftingrequirements) {
  const resources = asArray(craftingrequirements.craftresource)
    .map((r) => ({ uniqueName: r["@uniquename"], count: parseInt(r["@count"], 10) }))
    .filter((r) => r.uniqueName && !Number.isNaN(r.count));
  if (resources.length === 0) return null;
  if (resources.some((r) => isFactionResource(r.uniqueName))) return null;
  return {
    silver: parseInt(craftingrequirements["@silver"] ?? "0", 10),
    focusCost: parseInt(craftingrequirements["@craftingfocus"] ?? "0", 10),
    // Almost always 1 (one craft action = one unit), but confirmed by direct
    // inspection that some recipes genuinely batch-produce more per action
    // (e.g. T4_STONEBLOCK from certain option variants, T1_FISHCHOPS up to
    // 200 at once) — the evaluator (craft-finder/calc.ts) divides the
    // option's total cost by this to get a real per-unit cost.
    amountCrafted: parseInt(craftingrequirements["@amountcrafted"] ?? "1", 10),
    resources,
  };
}

function buildRow(entry, category, extractOptions) {
  const options = extractOptions
    ? asArray(entry.craftingrequirements).map(buildRecipeOption).filter((o) => o !== null)
    : [];
  return {
    uniqueName: entry["@uniquename"],
    category,
    tier: parseInt(entry["@tier"], 10),
    enchant: parseInt(entry["@enchantmentlevel"] ?? "0", 10),
    itemValue: parseInt(entry["@itemvalue"] ?? "0", 10),
    options,
  };
}

function extractCatalog(rawItems) {
  const rows = [];

  for (const entry of asArray(rawItems.items.simpleitem)) {
    if (!entry) continue;
    const uniqueName = entry["@uniquename"];
    const sub1 = entry["@shopsubcategory1"];
    const kind = SUBCATEGORY1_KIND[sub1];
    if (!uniqueName || !kind) continue;

    if (kind === "material-raw" || kind === "material-refined") {
      const rawCategory = entry["@shopsubcategory2"];
      if (!rawCategory) continue;
      const category = CATEGORY_ALIASES[rawCategory] ?? rawCategory;
      rows.push(buildRow(entry, category, kind === "material-refined"));
    } else {
      // food-leaf / food-recipe
      rows.push(buildRow(entry, FOOD_KIND_CATEGORY[sub1], kind === "food-recipe"));
    }
  }

  // Fish (consumableitem's own `fish` subcategory — the actual catchable
  // fish varieties, distinct from simpleitem's `fish` fish-sauce chain
  // above) — a plain buy-only leaf like a crop. Confirmed by inspection: no
  // `craftingrequirements` of its own.
  for (const entry of asArray(rawItems.items.consumableitem)) {
    if (!entry || entry["@shopsubcategory1"] !== "fish") continue;
    if (!entry["@uniquename"]) continue;
    rows.push(buildRow(entry, "cooking", false));
  }

  rows.sort((a, b) => a.uniqueName.localeCompare(b.uniqueName));
  return rows;
}

async function main() {
  console.log("Fetching ao-bin-dumps item data...");
  const rawItems = await fetchJson(RAW_ITEMS_URL);

  const catalog = extractCatalog(rawItems);

  writeFileSync(OUTPUT_PATH, JSON.stringify(catalog), "utf-8");
  console.log(`Wrote ${catalog.length} resource entries to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
